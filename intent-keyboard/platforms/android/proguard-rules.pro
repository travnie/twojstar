# LiteRT-LM JNI resolves Java/Kotlin classes and methods by their original names.
# Upstream bug: https://github.com/google-ai-edge/LiteRT-LM/issues/3739
# Scope only this native-backed library; keep R8 active for the rest of the app.
-keep class com.google.ai.edge.litertlm.** { *; }
