import asyncio
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from browser_use import Agent, BrowserSession
from browser_use.browser.profile import ProxySettings
from browser_use.llm.exceptions import ModelProviderError, ModelRateLimitError
from browser_use.llm.messages import BaseMessage
from browser_use.llm.openai.responses_serializer import ResponsesAPIMessageSerializer
from browser_use.llm.schema import SchemaOptimizer
from browser_use.llm.views import ChatInvokeCompletion, ChatInvokeUsage
from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel


DEFAULT_MODEL = "gpt-4.1"
DEFAULT_MAX_STEPS = 30
OPENAI_API_MODE = "responses"


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def read_json_stdin() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    return json.loads(raw)


def build_proxy() -> ProxySettings | None:
    proxy_server = get_env("BROWSER_USE_PROXY_SERVER")
    if not proxy_server:
        return None

    return ProxySettings(
        server=proxy_server,
        bypass=get_env("BROWSER_USE_PROXY_BYPASS"),
        username=get_env("BROWSER_USE_PROXY_USERNAME"),
        password=get_env("BROWSER_USE_PROXY_PASSWORD"),
    )


def build_browser_session() -> BrowserSession:
    user_data_dir = Path(
        get_env(
            "BROWSER_USE_USER_DATA_DIR",
            str(Path.cwd() / "data" / "browser-use-profile"),
        )
    )
    user_data_dir.mkdir(parents=True, exist_ok=True)

    return BrowserSession(
        headless=parse_bool(get_env("BROWSER_USE_HEADLESS"), default=False),
        user_data_dir=str(user_data_dir),
        proxy=build_proxy(),
    )


@dataclass
class ChatOpenAIResponses:
    model: str
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = 0.2
    max_completion_tokens: int | None = 4096
    reasoning_effort: str = "low"
    top_p: float | None = None
    service_tier: str | None = None
    remove_min_items_from_schema: bool = False
    remove_defaults_from_schema: bool = False

    @property
    def provider(self) -> str:
        return "openai"

    @property
    def name(self) -> str:
        return str(self.model)

    @property
    def model_name(self) -> str:
        return str(self.model)

    def get_client(self) -> AsyncOpenAI:
        client_params: dict[str, str] = {"api_key": self.api_key}
        if self.base_url:
            client_params["base_url"] = self.base_url
        return AsyncOpenAI(**client_params)

    def _get_usage(self, response) -> ChatInvokeUsage | None:
        if response.usage is None:
            return None

        cached_tokens = None
        if response.usage.input_tokens_details is not None:
            cached_tokens = getattr(
                response.usage.input_tokens_details, "cached_tokens", None
            )

        return ChatInvokeUsage(
            prompt_tokens=response.usage.input_tokens,
            prompt_cached_tokens=cached_tokens,
            prompt_cache_creation_tokens=None,
            prompt_image_tokens=None,
            completion_tokens=response.usage.output_tokens,
            total_tokens=response.usage.total_tokens,
        )

    async def ainvoke(
        self,
        messages: list[BaseMessage],
        output_format: type[BaseModel] | None = None,
        **kwargs,
    ) -> ChatInvokeCompletion:
        input_messages = ResponsesAPIMessageSerializer.serialize_messages(messages)

        model_params: dict[str, object] = {
            "model": self.model,
            "input": input_messages,
        }

        if self.temperature is not None:
            model_params["temperature"] = self.temperature
        if self.max_completion_tokens is not None:
            model_params["max_output_tokens"] = self.max_completion_tokens
        if self.top_p is not None:
            model_params["top_p"] = self.top_p
        if self.service_tier is not None:
            model_params["service_tier"] = self.service_tier

        if (
            "gpt-5" in self.name.lower()
            or "o3" in self.name.lower()
            or "o4" in self.name.lower()
        ):
            model_params["reasoning"] = {"effort": self.reasoning_effort}
            model_params.pop("temperature", None)

        try:
            if output_format is None:
                response = await self.get_client().responses.create(**model_params)
                return ChatInvokeCompletion(
                    completion=response.output_text or "",
                    usage=self._get_usage(response),
                    stop_reason=response.status if response.status else None,
                )

            json_schema = SchemaOptimizer.create_optimized_json_schema(
                output_format,
                remove_min_items=self.remove_min_items_from_schema,
                remove_defaults=self.remove_defaults_from_schema,
            )
            model_params["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "agent_output",
                    "strict": True,
                    "schema": json_schema,
                }
            }

            response = await self.get_client().responses.create(**model_params)
            if not response.output_text:
                raise ModelProviderError(
                    message="Failed to parse structured output from model response",
                    status_code=500,
                    model=self.name,
                )

            parsed = output_format.model_validate_json(response.output_text)
            return ChatInvokeCompletion(
                completion=parsed,
                usage=self._get_usage(response),
                stop_reason=response.status if response.status else None,
            )
        except RateLimitError as err:
            raise ModelRateLimitError(message=err.message, model=self.name) from err
        except APIConnectionError as err:
            raise ModelProviderError(message=str(err), model=self.name) from err
        except APIStatusError as err:
            raise ModelProviderError(
                message=err.message,
                status_code=err.status_code,
                model=self.name,
            ) from err
        except Exception as err:
            raise ModelProviderError(message=str(err), model=self.name) from err


def build_openai_llm() -> ChatOpenAIResponses:
    api_key = get_env("BROWSER_USE_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("BROWSER_USE_OPENAI_API_KEY is not set")

    configured_mode = get_env("BROWSER_USE_OPENAI_API_MODE", OPENAI_API_MODE)
    if configured_mode is not None and configured_mode.strip().lower() != "responses":
        raise RuntimeError(
            "BROWSER_USE_OPENAI_API_MODE must be 'responses'. Chat completions mode is not supported for this gateway."
        )

    kwargs: dict[str, Any] = {
        "model": get_env("BROWSER_USE_OPENAI_MODEL", DEFAULT_MODEL),
        "api_key": api_key,
    }
    base_url = get_env("BROWSER_USE_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url

    return ChatOpenAIResponses(**kwargs)


def build_task(goal: str, start_url: str | None) -> str:
    start_line = (
        f"Start from {start_url}.\n"
        if start_url
        else "Choose the most relevant starting point on the web.\n"
    )

    return (
        f"{start_line}"
        f"Research goal:\n{goal}\n\n"
        "Rules:\n"
        "- Use the current browser profile and any saved logged-in sessions if useful.\n"
        "- Research only. Do not post, purchase, change settings, or take unrelated account actions.\n"
        "- Read multiple sources before concluding.\n"
        "- Prefer concrete evidence over thin summaries.\n"
        "- Stop when you have enough information to answer well.\n\n"
        "Return strict JSON only with this shape:\n"
        "{"
        '"summary":"short answer",'
        '"findings":["key finding"],'
        '"sources":[{"title":"optional title","url":"https://example.com"}],'
        '"notes":["optional uncertainty or follow-up"]'
        "}"
    )


def normalize_sources(
    raw_sources: Any, fallback_urls: list[str]
) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    if isinstance(raw_sources, list):
        for item in raw_sources:
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if not isinstance(url, str) or not url.strip():
                continue
            title = item.get("title")
            source: dict[str, str] = {"url": url.strip()}
            if isinstance(title, str) and title.strip():
                source["title"] = title.strip()
            sources.append(source)

    seen_urls = {source["url"] for source in sources}
    for url in fallback_urls:
        if url not in seen_urls:
            sources.append({"url": url})
            seen_urls.add(url)
    return sources


def parse_result_payload(final_result: str | None, urls: list[str]) -> dict[str, Any]:
    if final_result:
        try:
            parsed = json.loads(final_result)
            if isinstance(parsed, dict):
                summary = parsed.get("summary")
                findings = parsed.get("findings")
                notes = parsed.get("notes")
                return {
                    "summary": summary if isinstance(summary, str) else final_result,
                    "findings": findings if isinstance(findings, list) else [],
                    "sources": normalize_sources(parsed.get("sources"), urls),
                    "notes": notes if isinstance(notes, list) else [],
                }
        except json.JSONDecodeError:
            pass

    return {
        "summary": final_result or "browser-use finished without a final summary.",
        "findings": [],
        "sources": normalize_sources([], urls),
        "notes": [],
    }


async def run_login() -> int:
    start_url = sys.argv[2] if len(sys.argv) > 2 else None
    if not isinstance(start_url, str) or not start_url.strip():
        start_url = get_env("BROWSER_USE_LOGIN_URL", "https://www.google.com/")

    browser_session = build_browser_session()
    try:
        await browser_session.start()
        await browser_session.navigate_to(start_url)
        profile_dir = get_env(
            "BROWSER_USE_USER_DATA_DIR",
            str(Path.cwd() / "data" / "browser-use-profile"),
        )
        print(f"Opened {start_url}")
        print(f"Browser profile: {profile_dir}")
        print("Log into any sites you want this skill to reuse later.")
        await asyncio.to_thread(
            input,
            "Press Enter after the browser session is ready to reuse... ",
        )
        print("Saved browser-use login state for future research runs.")
        return 0
    finally:
        try:
            await browser_session.kill()
        except Exception:
            pass


async def run_research() -> int:
    payload = read_json_stdin()
    goal = payload.get("goal")
    if not isinstance(goal, str) or not goal.strip():
        print(json.dumps({"success": False, "message": "Missing research goal."}))
        return 1

    start_url = payload.get("startUrl")
    if not isinstance(start_url, str) or not start_url.strip():
        start_url = None

    max_steps_raw = payload.get("maxSteps")
    if isinstance(max_steps_raw, int) and max_steps_raw > 0:
        max_steps = max_steps_raw
    else:
        try:
            max_steps = int(
                get_env("BROWSER_USE_MAX_STEPS", str(DEFAULT_MAX_STEPS))
                or DEFAULT_MAX_STEPS
            )
        except ValueError:
            max_steps = DEFAULT_MAX_STEPS

    llm = build_openai_llm()
    browser_session = build_browser_session()

    try:
        agent = Agent(
            task=build_task(goal.strip(), start_url),
            llm=llm,
            use_vision=True,
            browser_session=browser_session,
            max_actions_per_step=5,
            include_recent_events=True,
        )
        history = await agent.run(max_steps=max_steps)
        final_result = history.final_result()
        urls = [url for url in history.urls() if isinstance(url, str) and url.strip()]
        data = parse_result_payload(final_result, urls)
        message = (
            data["summary"]
            if isinstance(data["summary"], str)
            else "browser-use research completed."
        )
        print(json.dumps({"success": True, "message": message, "data": data}))
        return 0
    except Exception as err:
        print(json.dumps({"success": False, "message": str(err)}))
        return 1
    finally:
        try:
            await browser_session.kill()
        except Exception:
            pass


async def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "Missing mode argument."}))
        return 1

    mode = sys.argv[1]
    if mode == "login":
        return await run_login()
    if mode == "research":
        return await run_research()

    print(json.dumps({"success": False, "message": f"Unknown mode: {mode}"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
