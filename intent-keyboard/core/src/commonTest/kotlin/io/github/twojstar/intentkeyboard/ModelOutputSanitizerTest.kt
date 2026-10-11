package io.github.twojstar.intentkeyboard

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking

class ModelOutputSanitizerTest {
    @Test
    fun stripsReasoningAndAddedQuotesOnly() {
        assertEquals("See you at 6.", ModelOutputSanitizer.clean("<think>plan</think>\n\"See you at 6.\"", "see u at 6"))
        assertEquals("„Tak”", ModelOutputSanitizer.clean("„Tak”", "„tak”"))
        assertEquals("He said \"hi\" twice.", ModelOutputSanitizer.clean("He said \"hi\" twice.", "he said \"hi\" twice"))
    }

    @Test
    fun unterminatedReasoningLeavesNothingToCommit() {
        assertEquals("", ModelOutputSanitizer.clean("<think>still thinking about", "ok"))
        assertEquals("Fine.", ModelOutputSanitizer.clean("Fine.<think>trailing", "fine"))
    }

    @Test
    fun keepsThinkTagsTheUserWrote() {
        val raw = "wrap it in <think>draft</think> tags"
        assertEquals("Wrap it in <think>draft</think> tags.", ModelOutputSanitizer.clean("Wrap it in <think>draft</think> tags.", raw))
    }

    @Test
    fun flagsRunawayOutput() {
        assertFalse(ModelOutputSanitizer.isRunaway("I will be there around six tomorrow.", "tmrw 6"))
        assertTrue(ModelOutputSanitizer.isRunaway("x".repeat(200), "ok"))
    }

    @Test
    fun rendererFailsOnRunawayCompletion(): Unit = runBlocking {
        val renderer = ModelSemanticRenderer(
            object : SemanticCompletionClient {
                override suspend fun complete(prompt: ModelPrompt) = CompletionOutcome.Success("blah ".repeat(100))
            },
        )
        assertIs<RendererOutcome.Failure>(renderer.render(RenderRequest(rawIntent = "ok")))
    }
}
