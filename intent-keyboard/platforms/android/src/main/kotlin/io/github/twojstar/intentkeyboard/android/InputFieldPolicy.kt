package io.github.twojstar.intentkeyboard.android

import android.text.InputType
import android.view.inputmethod.EditorInfo

/** Pure decision on how much semantic processing a host field may receive. */
internal object InputFieldPolicy {
    enum class Mode {
        /** Normal draft: local model, remote fallback allowed. */
        SEMANTIC,

        /** Incognito/no-learning field: render locally only, never send text to a remote provider. */
        LOCAL_ONLY,

        /** Password-like: no buffer, no rendering. */
        SENSITIVE,

        /** Exact values (email, URL, numbers, phone, dates): no buffer, no rendering, typed as-is. */
        LITERAL,
    }

    private val passwordVariations = setOf(
        InputType.TYPE_TEXT_VARIATION_PASSWORD,
        InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
        InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
    )
    private val literalTextVariations = setOf(
        InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
        InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS,
        InputType.TYPE_TEXT_VARIATION_URI,
    )

    fun classify(inputType: Int, imeOptions: Int): Mode {
        val inputClass = inputType and InputType.TYPE_MASK_CLASS
        val variation = inputType and InputType.TYPE_MASK_VARIATION

        when (inputClass) {
            InputType.TYPE_CLASS_TEXT -> {
                if (variation in passwordVariations) return Mode.SENSITIVE
                if (variation in literalTextVariations) return Mode.LITERAL
            }
            InputType.TYPE_CLASS_NUMBER ->
                return if (variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) Mode.SENSITIVE else Mode.LITERAL
            InputType.TYPE_CLASS_PHONE,
            InputType.TYPE_CLASS_DATETIME,
            -> return Mode.LITERAL
        }

        if (imeOptions and EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING != 0) return Mode.LOCAL_ONLY
        return Mode.SEMANTIC
    }
}
