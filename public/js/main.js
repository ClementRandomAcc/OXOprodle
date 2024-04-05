import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { pokemons } from "./pokemon.js";
import { AppState } from "./appState.js";

const firebaseConfig = {
  apiKey: "AIzaSyAax11e3bw7IoHJEYOCwtmF8tKJrXRV0Mo",
  authDomain: "prodle-6f709.firebaseapp.com",
  projectId: "prodle-6f709",
  storageBucket: "prodle-6f709.appspot.com",
  messagingSenderId: "401741985369",
  appId: "1:401741985369:web:d9d881983cfd8b12292348",
  measurementId: "G-ZKMZPFQ567",
};

// initialize Firebase Authentication
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

// request for browser notifications
Notification.requestPermission((permission) => {
  if (permission != "granted")
    console.log("Permission for notifications was not granted.");
  else console.log("Notifications enabled.");
});

// sends notifications on login/logout, if enabled
function sendNotification(message) {
  if ("Notification" in window)
    Notification.requestPermission().then((permission) => {
      if (permission === "granted")
        new Notification("Pokédle", {
          body: message,
          icon: "/public/images/icon-192x192.png",
        });
    });
}

let appState = new AppState(); // initializing app state
// get all important html elements to manage
let loginButton = document.getElementById("loginButton");
let profileButton = document.getElementById("profileButton");
let pokedexButton = document.getElementById("pokedexButton");
let rankingsButton = document.getElementById("rankingsButton");
let sendButton = document.getElementById("bouncyButton");
let timer = document.getElementById("timer");
let containerbar = document.getElementById("bar-container");
let subtitle = document.getElementById("subtitle");
let titles = document.getElementById("category-titles");
let inp = document.getElementById("myInput");
autocomplete(inp, pokemons); // initializing autocomplete textbar

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginButton.value = "Logout";
    profileButton.style.visibility = "visible";
    pokedexButton.style.visibility = "visible";
  } else {
    loginButton.value = "Login with Google";
    profileButton.style.visibility = "hidden";
    pokedexButton.style.visibility = "hidden";
  }
});

appState.setSavedID(); // set the saved unique id from localStorage (or request it to server if not present)
// send a request to server to retrieve various info
axios.get("/id/status/" + appState.getID()).then((response) => {
  // check if user can play or not
  if (response.data[0])
    subtitle.textContent = "You can't make anymore tries... Come back later...";
  else {
    containerbar.style.animation = "fadeIn 1.5s";
    containerbar.style.visibility = "visible";
    subtitle.textContent = "I'm thinking of a Pokémon, can you guess it?";
  }
  var timestamp = appState.getTimestamp(); // timestamp of the generation of current state
  // second index of response is the timestamp of the pokemon generation
  if (timestamp == null || timestamp < response.data[1]) {
    appState.removeState(); // state expired, discard
    appState.removeTimestamp();
  } else {
    appState.setSavedState(); // set state from localStorage
    // render previous state if present
    if (appState.isPresent()) {
      appState.renderAll();
      titles.style.visibility = "visible";
    }
  }
  var remainingTime = response.data[1] + 300 * 1000 - Date.now();
  // reload page automatically when the new pokemon is generated
  setTimeout(() => {
    window.location.reload();
  }, remainingTime);
  // set up the timer to inform user about new pokemon generation
  var minutes = Math.floor(remainingTime / 60000);
  var seconds = ((remainingTime % 60000) / 1000).toFixed(0);
  setInterval(() => {
    if (minutes <= 0 && seconds <= 0) return;
    if (minutes >= 1 && seconds == 0) {
      minutes--;
      seconds = 59;
    } else seconds--;
    timer.textContent =
      "New Pokémon in " + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }, 1000);
});

loginButton.addEventListener("click", () => {
  if (auth.currentUser == null)
    signInWithPopup(auth, provider).then(() => {
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
    });
  else
    signOut(auth).then(() => {
      sendNotification("Logged out successfully.");
    });
});

profileButton.addEventListener("click", () => {
  window.location.href = `/profile/${auth.currentUser.uid}`;
});

pokedexButton.addEventListener("click", () => {
  window.location.href = `/profile/${auth.currentUser.uid}/pokedex`;
});

rankingsButton.addEventListener("click", () => {
  window.location.href = "/rankings";
});

sendButton.addEventListener("click", () => {
  var myGuess = inp.value;
  inp.value = "";
  // in case of some types of errors, textbox will shake to notify the user
  if (myGuess == "" || !pokemons.includes(myGuess)) {
    var textbox = document.getElementById("autocomplete");
    textbox.classList.remove("shake");
    void textbox.offsetWidth;
    textbox.classList.add("shake");
    return;
  }
  var updatedTries = appState.getTries() + 1;
  if (auth.currentUser != null) {
    var uid = auth.currentUser.uid;
    var name = auth.currentUser.displayName;
  } else {
    var uid = null;
    var name = null;
  }
  axios
    .post("/", {
      googleID: uid,
      googleName: name,
      guess: myGuess,
      tries: updatedTries,
      uid: appState.getID(),
    })
    .then((response) => {
      // if this is the first attempt, saves the timestamp in localStorage
      if (!appState.isPresent()) {
        window.localStorage.setItem("timestamp", JSON.stringify(Date.now()));
        titles.style.visibility = "visible"; // hint categories will be shown as well
      }
      // forward to appState to generate the hints on the guess
      appState.add(response.data);
      if (response.data[1].hasWon) {
        inp.disabled = true; // textbar is disabled
        setTimeout(() => {
          onVictory(updatedTries, response.data[0].name, response.data[0].bio);
        }, 1000);
        appState.removeState(); // resetting the state
        appState.removeTimestamp();
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

function onVictory(tries, pokename, bio) {
  var div = document.createElement("DIV");
  div.setAttribute("id", "victory-ad");
  subtitle.insertAdjacentElement("afterend", div);
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    div.innerHTML = `<div><br><br><br><br><b>GG!</b><br><br><br><br></div>
    <div><b>It was ${pokename} indeed!</b></div><div><img src='/public/images/sprites/${pokename}.png' width='180px' height='180px'>
    </div><div><br><br><b>${bio}</b></div><div><br><br><b>You guessed it in ${tries} tries...</b></div><div><br><br><b>Think you can do better? Let's see!</b>
    <br><br></div><div><br><a href='/'><button id='victoryButton'>Continue</button></a></div>`;
  }, 1500);
}

// management of autocomplete text bar
function autocomplete(input, arr) {
  input.addEventListener("input", function (e) {
    var a, b;
    var val = this.value;
    closeAllLists();
    if (!val) return false;
    a = document.createElement("DIV");
    a.setAttribute("id", this.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(a);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        b = document.createElement("DIV");
        b.className = "list-option";
        b.innerHTML = `<img src='/public/images/sprites/${
          arr[i]
        }.png' width='70px' height='70px'>
          <strong>${arr[i].substr(0, val.length)}</strong>${arr[i].substr(
          val.length
        )}
      <input type='hidden' value='${arr[i]}'>`;
        b.addEventListener("click", function (e) {
          input.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });
        a.appendChild(b);
      }
    }
  });

  function closeAllLists(elmnt) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++)
      if (elmnt != x[i] && elmnt != input) x[i].parentNode.removeChild(x[i]);
  }

  document.addEventListener("click", (e) => {
    closeAllLists(e.target);
  });
}
