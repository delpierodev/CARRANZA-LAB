import { auth } from "./firebase.js?v=20260413a";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.login = async function () {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("error");

    errorBox.textContent = "";

    if(!email || !password){
        errorBox.textContent = "Completa todos los campos";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);

        window.location.href = "admin.html";

    } catch (error) {
        errorBox.textContent = "Correo o contraseña incorrectos";
    }
};