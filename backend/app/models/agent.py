import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    module: Mapped[str] = mapped_column(String(500), nullable=False)
    agent_class: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False, default="local_python")
    connection_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    capabilities: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    auth_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    default_llm_model: Mapped[str] = mapped_column(String(255), default="gpt-4o-mini")
    default_judge_model: Mapped[str] = mapped_column(String(255), default="gpt-4o-mini")
    default_agent_args: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    arg_schema: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="UI input schema derived from agent constructor (name, type, required, default)"
    )
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    scenarios: Mapped[list["Scenario"]] = relationship(back_populates="agent")
    versions: Mapped[list["AgentVersion"]] = relationship(
        "AgentVersion", back_populates="agent", cascade="all, delete-orphan", order_by="AgentVersion.version"
    )


# Avoid circular import
from app.models.scenario import Scenario  # noqa: E402
