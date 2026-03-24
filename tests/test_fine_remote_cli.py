from __future__ import annotations

import io
import unittest

from fine_remote.cli import write_text


class _MemoryStream:
    def __init__(self) -> None:
        self.buffer = io.BytesIO()


class FineRemoteCliOutputTest(unittest.TestCase):
    def test_write_text_uses_utf8_for_buffered_stream(self) -> None:
        stream = _MemoryStream()

        write_text(stream, "远程设计连接失败：\uFFFD")

        self.assertEqual(
            stream.buffer.getvalue(),
            "远程设计连接失败：\uFFFD\n".encode("utf-8"),
        )

    def test_write_text_falls_back_to_text_stream(self) -> None:
        stream = io.StringIO()

        write_text(stream, "ok")

        self.assertEqual(stream.getvalue(), "ok\n")


if __name__ == "__main__":
    unittest.main()
