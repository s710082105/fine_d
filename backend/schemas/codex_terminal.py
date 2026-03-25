from pydantic import BaseModel, ConfigDict, Field

from backend.domain.codex_terminal.models import (
    CodexTerminalInputAccepted,
    CodexTerminalSession,
    CodexTerminalStreamChunk,
    TerminalSessionStatus,
)


class CodexTerminalCreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    working_directory: str


class CodexTerminalInputRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data: str


class CodexTerminalSessionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    session_id: str
    status: TerminalSessionStatus
    working_directory: str

    @classmethod
    def from_domain(
        cls,
        session: CodexTerminalSession,
    ) -> "CodexTerminalSessionResponse":
        return cls(
            session_id=session.session_id,
            status=session.status,
            working_directory=session.working_directory,
        )


class CodexTerminalStreamResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    session_id: str
    status: TerminalSessionStatus
    output: str
    next_cursor: int = Field(ge=0)
    completed: bool

    @classmethod
    def from_domain(
        cls,
        chunk: CodexTerminalStreamChunk,
    ) -> "CodexTerminalStreamResponse":
        return cls(
            session_id=chunk.session_id,
            status=chunk.status,
            output=chunk.output,
            next_cursor=chunk.next_cursor,
            completed=chunk.completed,
        )


class CodexTerminalInputAcceptedResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    accepted: bool

    @classmethod
    def from_domain(
        cls,
        accepted: CodexTerminalInputAccepted,
    ) -> "CodexTerminalInputAcceptedResponse":
        return cls(accepted=accepted.accepted)
