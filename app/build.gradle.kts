plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
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
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
