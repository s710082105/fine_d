import os
import struct
from importlib import import_module


def _load_terminal_gateway_module():
    return import_module("backend.adapters.system.terminal_gateway")


def test_build_terminal_environment_replaces_dumb_term(monkeypatch) -> None:
    module = _load_terminal_gateway_module()
    monkeypatch.setenv("TERM", "dumb")
    monkeypatch.setenv("PATH", os.environ.get("PATH", ""))

    env = module._build_terminal_environment()

    assert env["TERM"] == "xterm-256color"
    assert env["PATH"] == os.environ["PATH"]


def test_build_terminal_environment_keeps_existing_supported_term(
    monkeypatch,
) -> None:
    module = _load_terminal_gateway_module()
    monkeypatch.setenv("TERM", "screen-256color")

    env = module._build_terminal_environment()

    assert env["TERM"] == "screen-256color"


def test_build_terminal_environment_sets_default_dimensions(monkeypatch) -> None:
    module = _load_terminal_gateway_module()
    monkeypatch.delenv("LINES", raising=False)
    monkeypatch.delenv("COLUMNS", raising=False)

    env = module._build_terminal_environment()

    assert env["LINES"] == str(module.DEFAULT_TERMINAL_ROWS)
    assert env["COLUMNS"] == str(module.DEFAULT_TERMINAL_COLUMNS)


def test_configure_pty_window_size_uses_default_dimensions(monkeypatch) -> None:
    module = _load_terminal_gateway_module()
    calls: list[tuple[int, int, bytes]] = []

    class FakeTermios:
        TIOCSWINSZ = 12345

    def fake_ioctl(fd: int, command: int, payload: bytes) -> None:
        calls.append((fd, command, payload))

    monkeypatch.setattr(module, "termios", FakeTermios)
    monkeypatch.setattr(module, "fcntl", type("FakeFcntl", (), {"ioctl": fake_ioctl}))

    module._configure_pty_window_size(7)

    assert len(calls) == 1
    fd, command, payload = calls[0]
    rows, columns, x_pixels, y_pixels = struct.unpack("HHHH", payload)
    assert fd == 7
    assert command == FakeTermios.TIOCSWINSZ
    assert rows == module.DEFAULT_TERMINAL_ROWS
    assert columns == module.DEFAULT_TERMINAL_COLUMNS
    assert x_pixels == 0
    assert y_pixels == 0


def test_runtime_discards_consumed_output_prefix() -> None:
    module = _load_terminal_gateway_module()

    class FakeProcess:
        def poll(self):
            return None

    runtime = module.SubprocessTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=__import__("pathlib").Path("/tmp/project-alpha"),
        process=FakeProcess(),
        reader=lambda: b"",
        writer=lambda data: None,
        close_transport=lambda: None,
    )
    with runtime._buffer_lock:
        runtime._buffer = "x" * (module.MAX_STREAM_CHUNK_CHARS * 3)

    runtime.read(0)
    runtime.read(module.MAX_STREAM_CHUNK_CHARS)
    chunk, next_cursor, completed = runtime.read(module.MAX_STREAM_CHUNK_CHARS * 2)

    assert len(chunk) == module.MAX_STREAM_CHUNK_CHARS
    assert next_cursor == module.MAX_STREAM_CHUNK_CHARS * 3
    assert completed is False
    with runtime._buffer_lock:
        assert len(runtime._buffer) <= module.MAX_STREAM_CHUNK_CHARS * 2
