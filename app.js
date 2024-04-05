const initializeApp = require("firebase/app").initializeApp;
const firestore = require("firebase/firestore");
const { v4: uuidv4 } = require("uuid");

var createError = require("http-errors");
var logger = require("morgan");
var path = require("path");
var express = require("express");

const firebaseConfig = {
  apiKey: "AIzaSyAax11e3bw7IoHJEYOCwtmF8tKJrXRV0Mo",
  authDomain: "prodle-6f709.firebaseapp.com",
  projectId: "prodle-6f709",
  storageBucket: "prodle-6f709.appspot.com",
  messagingSenderId: "401741985369",
  appId: "1:401741985369:web:d9d881983cfd8b12292348",
  measurementId: "G-ZKMZPFQ567",
};

// initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = firestore.getFirestore(firebaseApp);

var index = 0; // index of winners array
var winners = []; // to store unique id of players who have won the current game
var timestamp; // to store the time when pokemon is generated
var generatedPokemon; // to store the generated pokemon
var generateInterval = 300; // in seconds, the interval between each generation

async function generatePokemon() {
  index = 0;
  winners.length = 0;
  timestamp = Date.now();
  var proID = Math.floor(Math.random() * 2 + 1);
  var proRef = firestore.doc(db, "prodle", proID.toString());
  var proDoc = await firestore.getDoc(proRef);
  generatedPro = proDoc.data();
  console.log("Onestla");
  console.log(generatedPro);
  console.log("!!! Current pro: " + generatedPro.name + " !!!");
}

// verify the client's guess, generate hints based on it
function verifyGuess(guess, answer) {
  var response = {
    hasWon: true,
    country: "correct",
    gender: "correct",
    game: "correct",
    studio: "correct",
    age: "correct",
    job: "correct",
  };
  var count = 0;

  if (guess.name != answer.name) {
    response.hasWon = false;
    if (guess.gender != answer.gender)
      response.gender = "wrong";
    if (guess.age != answer.age)
      response.age = "wrong";
    if (guess.country != answer.country) response.country = "wrong";

    var guessGames = guess.game.split(", ");
    for (var i = 0; i < guessGames.length; i++)
      if (answer.game.includes(guessGames[i])) count++;
    var games = answer.game.split(", ");
    if (count == 0) response.game = "wrong";
    else if (games.length != count || guessGames.length != count)
      response.game = "partial";
    count = 0;

    var guessJobs = guess.job.split(", ");
    for (var i = 0; i < guessJobs.length; i++)
      if (answer.job.includes(guessJobs[i])) count++;
    var jobs = answer.job.split(", ");
    if (count == 0) response.job = "wrong";
    else if (jobs.length != count || guessJobs.length != count)
      response.job = "partial";
    count = 0;

    var guessStudios = guess.studio.split(", ");
    for (var i = 0; i < guessStudios.length; i++)
      if (answer.studio.includes(guessStudios[i])) count++;
    var studios = answer.studio.split(", ");
    if (count == 0) response.studio = "wrong";
    else if (studios.length != count || guessStudios.length != count)
      response.studio = "partial";
  }
  return response;
}

// get a user from database given his id
async function getUserById(id) {
  var userRef = firestore.doc(db, "users", id);
  var userDoc = await firestore.getDoc(userRef);
  if (userDoc.exists()) return userDoc.data();
  else return null;
}

// update user's stats and pokedex on winning
async function updateStatsOnWinning(id, name, pokemon, tries) {
  var user = await getUserById(id);
  if (user == null)
    // if is a first-login user, set up a fresh document
    user = {
      name: name,
      wins: 1,
      avgTries: tries,
      history: [{ pokemon: pokemon, timesGuessed: 1 }],
    };
  else {
    // updating stats
    user.avgTries = (user.wins * user.avgTries + tries) / (user.wins + 1);
    user.wins++;
    // updating the pokedex
    var found = false;
    for (var i = 0; i < user.history.length; i++) {
      if (user.history[i].pokemon == pokemon) {
        user.history[i].timesGuessed++;
        found = true;
        break;
      }
    }
    if (!found) user.history.push({ pokemon: pokemon, timesGuessed: 1 });
  }
  // update (or create) the document
  var userRef = firestore.doc(db, "users", id);
  firestore.setDoc(userRef, user);
}

generatePokemon(); // first pokemon is generated here
setInterval(() => generatePokemon(), generateInterval * 1000); // new pokemon will be generated every 5 minutes

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "")));

// render home page
app.get("/", (req, res) => {
  res.render("index");
});

// generate hints based on user's guess, check if user has won and, if so, call an update to his stats
app.post("/", async (req, res) => {
  var query = firestore.query(
    firestore.collection(db, "prodle"),
    firestore.where("name", "==", req.body.guess)
  );
  var pokemonDocs = await firestore.getDocs(query);
  pokemonDocs.forEach((doc) => {
    var guess = doc.data();
    // confronting guess with answer, returns the hints to help user's guesses
    var response = verifyGuess(guess, generatedPro);
    // if (response.hasWon) {
    //   // winners won't be able to play until a new pokemon is generated
    //   winners[index] = req.body.uid;
    //   index++;
    //   // if user is logged in, update his stats
    //   if (req.body.googleID != null)
    //     updateStatsOnWinning(
    //       req.body.googleID,
    //       req.body.googleName,
    //       req.body.guess,
    //       req.body.tries
    //     );
    // }
    res.status(201);
    res.send([guess, response]);
  });
});

// render profile data about requested user
app.get("/profile/:id", async (req, res, next) => {
  var user = await getUserById(req.params.id);
  if (user == null)
    next(createError("This user does not exist or has not played yet!"));
  else {
    res.status(200);
    res.render("profile", {
      name: user.name,
      wins: user.wins,
      avgTries: Math.round(user.avgTries * 100) / 100,
    });
  }
});

// render requested user's pokedex page
app.get("/profile/:id/pokedex", async (req, res, next) => {
  var user = await getUserById(req.params.id);
  if (user == null)
    next(createError("This user does not exist or has not played yet!"));
  else {
    res.status(200);
    res.render("pokedex", { name: user.name, history: user.history });
  }
});

// render rankings page with top 10 users
app.get("/rankings", async (req, res) => {
  var query = firestore.query(
    firestore.collection(db, "users"),
    firestore.orderBy("wins", "desc"),
    firestore.limit(10)
  );
  var userDocs = await firestore.getDocs(query);
  var i = 0;
  var topTen = [];
  userDocs.forEach((doc) => {
    var obj = {};
    obj.id = doc.id;
    obj.name = doc.data().name;
    obj.wins = doc.data().wins;
    topTen[i] = obj;
    i++;
  });
  res.status(200);
  res.render("rankings", { rankingData: topTen });
});

// generate new unique id for user
app.get("/id", (req, res) => {
  res.status(201);
  res.send(uuidv4());
});

// send a boolean that states if user can play current game and a timestamp of the current pokemon generation
app.get("/id/status/:id", (req, res) => {
  res.status(200);
  res.send([winners.includes(req.params.id), timestamp]);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
