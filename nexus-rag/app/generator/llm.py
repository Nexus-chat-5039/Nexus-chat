import os
import logging
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv

from app.core.config import GEMINI_API_KEY, LLM_MODEL, LLM_TIMEOUT, LLM_MAX_RETRIES

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Gemini client
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    client = genai.GenerativeModel(model_name=LLM_MODEL)
else:
    client = None


async def generate_answer(prompt: str, temperature: float = 0.2) -> str:
    """
    Generate an answer using the LLM with timeout and retry logic.
    
    Args:
        prompt: The prompt to send to the LLM
        temperature: Temperature for generation (0.0-1.0)
    
    Returns:
        Generated answer string
    
    Raises:
        RuntimeError: If LLM generation fails after all retries
    """
    if not client:
        logger.error("Gemini client not initialized - missing API key")
        return "AI service is not configured. Please check your API key settings."
    
    for attempt in range(LLM_MAX_RETRIES):
        try:
            logger.debug(f"LLM generation attempt {attempt + 1}/{LLM_MAX_RETRIES}")
            
            # Generate with timeout
            def _generate():
                return client.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=2048,
                    )
                )
            
            response = await asyncio.wait_for(
                asyncio.to_thread(_generate),
                timeout=LLM_TIMEOUT
            )
            
            answer = response.text
            
            if not answer:
                logger.warning("Empty response from LLM")
                return "I apologize, but I couldn't generate a response. Please try again."
            
            logger.debug(f"LLM generation successful (attempt {attempt + 1})")
            return answer
            
        except asyncio.TimeoutError:
            logger.warning(f"LLM request timeout (attempt {attempt + 1}/{LLM_MAX_RETRIES})")
            if attempt == LLM_MAX_RETRIES - 1:
                return "The AI service is taking too long to respond. Please try again later."
            await asyncio.sleep(1 * (attempt + 1))  # Exponential backoff
            
        except genai.types.BlockedPromptException as e:
            logger.warning(f"Prompt blocked by Gemini safety filters: {e}")
            if attempt == LLM_MAX_RETRIES - 1:
                return "Your request was blocked by safety policies. Please rephrase your question."
            await asyncio.sleep(1 * (attempt + 1))
            
        except genai.types.StopCandidateException as e:
            logger.warning(f"Generation stopped: {e}")
            if attempt == LLM_MAX_RETRIES - 1:
                return "Generation was stopped. Please try again."
            await asyncio.sleep(1 * (attempt + 1))
            
        except Exception as e:
            # Handle rate limits and other API errors
            error_str = str(e).lower()
            if "rate" in error_str or "quota" in error_str:
                logger.warning(f"Rate limit hit: {e}")
                if attempt == LLM_MAX_RETRIES - 1:
                    return "The AI service is currently at capacity. Please try again in a moment."
                await asyncio.sleep(2 * (attempt + 1))
            else:
                logger.error(f"Gemini API error: {e}")
                if attempt == LLM_MAX_RETRIES - 1:
                    return "There was an issue with the AI service. Please try again later."
                await asyncio.sleep(1 * (attempt + 1))
    
    # This should never be reached, but just in case
    return "Failed to generate a response. Please try again."
