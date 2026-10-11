package io.github.twojstar.intentkeyboard.android

import android.text.InputType
import android.view.inputmethod.EditorInfo
import io.github.twojstar.intentkeyboard.android.InputFieldPolicy.Mode
import org.junit.Assert.assertEquals
import org.junit.Test

class InputFieldPolicyTest {
    private fun text(variation: Int) = InputType.TYPE_CLASS_TEXT or variation

    @Test
    fun passwordsAreSensitive() {
        assertEquals(Mode.SENSITIVE, InputFieldPolicy.classify(text(InputType.TYPE_TEXT_VARIATION_PASSWORD), 0))
        assertEquals(Mode.SENSITIVE, InputFieldPolicy.classify(text(InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD), 0))
        assertEquals(
            Mode.SENSITIVE,
            InputFieldPolicy.classify(InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD, 0),
        )
    }

    @Test
    fun exactValueFieldsAreTypedLiterally() {
        assertEquals(Mode.LITERAL, InputFieldPolicy.classify(text(InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS), 0))
        assertEquals(Mode.LITERAL, InputFieldPolicy.classify(text(InputType.TYPE_TEXT_VARIATION_URI), 0))
        assertEquals(Mode.LITERAL, InputFieldPolicy.classify(InputType.TYPE_CLASS_NUMBER, 0))
        assertEquals(Mode.LITERAL, InputFieldPolicy.classify(InputType.TYPE_CLASS_PHONE, 0))
        assertEquals(Mode.LITERAL, InputFieldPolicy.classify(InputType.TYPE_CLASS_DATETIME, 0))
    }

    @Test
    fun incognitoTextStaysLocalAndPlainTextIsSemantic() {
        val plain = text(InputType.TYPE_TEXT_VARIATION_NORMAL)
        assertEquals(Mode.LOCAL_ONLY, InputFieldPolicy.classify(plain, EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING))
        assertEquals(Mode.SEMANTIC, InputFieldPolicy.classify(plain, 0))
        assertEquals(Mode.SEMANTIC, InputFieldPolicy.classify(InputType.TYPE_NULL, 0))
    }
}
