plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.roborazzi)
}

android {
    namespace = "app.kiumu.accura"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.kiumu.accura"
        minSdk = 31
        targetSdk = 37
        versionCode = 1
        versionName = "0.0.1-phase0"
    }

    // The release key never enters the repo. Path and password come from
    // ~/.gradle/gradle.properties, see docs/SIGNIERUNG.md. Without them the release
    // build stays unsigned and cannot be installed.
    val releaseStoreFile = providers.gradleProperty("accuraReleaseStoreFile").orNull
    signingConfigs {
        if (releaseStoreFile != null) {
            create("release") {
                storeFile = file(releaseStoreFile)
                // PKCS12 has one password for the store and the key.
                storePassword = providers.gradleProperty("accuraReleasePassword").get()
                keyAlias = "accura"
                keyPassword = providers.gradleProperty("accuraReleasePassword").get()
            }
        }
    }

    buildTypes {
        debug {
            // Own app next to the release build, so a test install never replaces real data.
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    // Die Vertragsbeispiele (Antworten der Convex-Abfragen als JSON) liegen als Testressourcen
    // und sind zugleich die Daten der Fake-Datenquelle im Debug-Build.
    sourceSets.getByName("debug").assets.directories.add("src/test/resources/vertrag")

    testOptions {
        unitTests {
            // Roborazzi und Compose-Tests brauchen Android-Ressourcen unter Robolectric.
            isIncludeAndroidResources = true
            all { test ->
                // Robolectric für Android 17 greift auf JDK-Interna zu (ApplicationSharedMemory).
                test.jvmArgs("--add-opens=java.base/jdk.internal.access=ALL-UNNAMED")
                test.maxHeapSize = "2g"
            }
        }
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit.rule)
}
