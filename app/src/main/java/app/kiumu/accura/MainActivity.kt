package app.kiumu.accura

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.kiumu.accura.ui.AccuraApp

/** Hält die Abhängigkeiten über die Lebensdauer der Activity hinaus, damit Drehen die Sitzung nicht verliert. */
class AccuraApplication : Application() {
    val graph: AppGraph by lazy { createAppGraph(this) }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val graph = (application as AccuraApplication).graph
        setContent { AccuraApp(graph) }
    }
}
