import errno
import os
import shutil
import subprocess
from pathlib import Path
from threading import Lock, Thread
from typing import Callable

from backend.domain.codex_terminal.models import (
    MAX_STREAM_CHUNK_CHARS,
    codex_command_missing_error,
    terminal_session_close_failed_error,
    terminal_session_input_failed_error,
    terminal_session_read_failed_error,
    terminal_session_start_failed_error,
)

READ_BUFFER_SIZE = 4096
PROCESS_CLOSE_TIMEOUT_SECONDS = 5


class CodexTerminalGateway:
    def create_runtime(
        self,
        session_id: str,
        working_directory: Path,
    ) -> "SubprocessTerminalRuntime":
        command = shutil.which("codex")
        if command is None:
            raise codex_command_missing_error()
        try:
            return _create_runtime(command, session_id, working_directory)
        except OSError as exc:
            raise terminal_session_start_failed_error(
                str(working_directory),
                str(exc),
            ) from exc
        except subprocess.SubprocessError as exc:
            raise terminal_session_start_failed_error(
                str(working_directory),
                str(exc),
            ) from exc


class SubprocessTerminalRuntime:
    def __init__(
        self,
        session_id: str,
        working_directory: Path,
        process: subprocess.Popen[bytes],
        reader: Callable[[], bytes],
        writer: Callable[[bytes], None],
        close_transport: Callable[[], None],
    ) -> None:
        self.session_id = session_id
        self.working_directory = working_directory
        self._process = process
        self._reader = reader
        self._writer = writer
        self._close_transport = close_transport
        self._buffer = ""
        self._buffer_lock = Lock()
        self._write_lock = Lock()
        self._read_error: Exception | None = None
        self._status = "running"
        self._reader_thread = Thread(target=self._consume_output, daemon=True)
        self._reader_thread.start()

    @property
    def status(self) -> str:
        if self._status != "running":
            return self._status
        if self._read_error is not None:
            return "failed"
        if self._process.poll() is not None:
            return "closed"
        return "running"

    def read(self, cursor: int) -> tuple[str, int, bool]:
        self._raise_read_error()
        with self._buffer_lock:
            total_length = len(self._buffer)
            next_cursor = min(total_length, cursor + MAX_STREAM_CHUNK_CHARS)
            chunk = self._buffer[cursor:next_cursor]
        completed = self.status != "running" and next_cursor >= total_length
        return chunk, next_cursor, completed

    def write(self, data: str) -> None:
        if self.status != "running":
            raise terminal_session_input_failed_error(
                self.session_id,
                "process is not running",
            )
        try:
            encoded = data.encode("utf-8")
            with self._write_lock:
                self._writer(encoded)
        except (BrokenPipeError, OSError, ValueError) as exc:
            raise terminal_session_input_failed_error(
                self.session_id,
                str(exc),
            ) from exc

    def close(self) -> None:
        try:
            if self._process.poll() is None:
                self._process.terminate()
                self._process.wait(timeout=PROCESS_CLOSE_TIMEOUT_SECONDS)
            self._close_transport()
            self._reader_thread.join(timeout=1)
        except subprocess.TimeoutExpired as exc:
            self._process.kill()
            self._process.wait(timeout=PROCESS_CLOSE_TIMEOUT_SECONDS)
            self._close_transport()
            self._reader_thread.join(timeout=1)
        except (OSError, subprocess.SubprocessError) as exc:
            raise terminal_session_close_failed_error(
                self.session_id,
                str(exc),
            ) from exc
        self._status = "closed"

    def _consume_output(self) -> None:
        while True:
            try:
                chunk = self._reader()
            except OSError as exc:
                if _is_pty_eof(exc):
                    break
                self._read_error = exc
                return
            if not chunk:
                return
            decoded = chunk.decode("utf-8", errors="replace")
            with self._buffer_lock:
                self._buffer += decoded

    def _raise_read_error(self) -> None:
        if self._read_error is None:
            return
        raise terminal_session_read_failed_error(
            self.session_id,
            str(self._read_error),
        )


def _create_runtime(
    command: str,
    session_id: str,
    working_directory: Path,
) -> SubprocessTerminalRuntime:
    if os.name == "nt":
        return _create_pipe_runtime(command, session_id, working_directory)
    return _create_pty_runtime(command, session_id, working_directory)


def _create_pipe_runtime(
    command: str,
    session_id: str,
    working_directory: Path,
) -> SubprocessTerminalRuntime:
    process = subprocess.Popen(
        [command],
        cwd=str(working_directory),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
    )
    if process.stdin is None or process.stdout is None:
        raise terminal_session_start_failed_error(
            str(working_directory),
            "pipe transport unavailable",
        )
    return SubprocessTerminalRuntime(
        session_id=session_id,
        working_directory=working_directory,
        process=process,
        reader=lambda: process.stdout.read(READ_BUFFER_SIZE),
        writer=_build_pipe_writer(process),
        close_transport=_build_pipe_closer(process),
    )


def _create_pty_runtime(
    command: str,
    session_id: str,
    working_directory: Path,
) -> SubprocessTerminalRuntime:
    import pty

    master_fd, slave_fd = pty.openpty()
    process = subprocess.Popen(
        [command],
        cwd=str(working_directory),
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        bufsize=0,
        close_fds=True,
    )
    os.close(slave_fd)
    return SubprocessTerminalRuntime(
        session_id=session_id,
        working_directory=working_directory,
        process=process,
        reader=lambda: os.read(master_fd, READ_BUFFER_SIZE),
        writer=lambda data: os.write(master_fd, data),
        close_transport=lambda: _close_fd(master_fd),
    )


def _build_pipe_writer(
    process: subprocess.Popen[bytes],
) -> Callable[[bytes], None]:
    def write_to_pipe(data: bytes) -> None:
        if process.stdin is None:
            raise ValueError("stdin is not available")
        process.stdin.write(data)
        process.stdin.flush()

    return write_to_pipe


def _build_pipe_closer(
    process: subprocess.Popen[bytes],
) -> Callable[[], None]:
    def close_pipe() -> None:
        if process.stdin is not None:
            process.stdin.close()
        if process.stdout is not None:
            process.stdout.close()

    return close_pipe


def _close_fd(fd: int) -> None:
    try:
        os.close(fd)
    except OSError:
        return


def _is_pty_eof(error: OSError) -> bool:
    return os.name != "nt" and error.errno == errno.EIO
