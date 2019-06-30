var express = require("express");
var mongoose = require("mongoose");
var path = require("path");

var db = require("./models");

var axios = require("axios");
var cheerio = require("cheerio");

mongoose.Promise = Promise;

var PORT = process.env.PORT || 3000

var app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("public"));

var bars = require("express-handlebars");

app.engine("handlebars", bars({
  defaultLayout: "main",
  partials: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";
mongoose.connect(MONGODB_URI);

app.get("/", function (req, res) {
  db.Article.find({ "saved": false }, function (error, data) {
    var barsObj = {
      article: data
    };
    console.log(barsObj);
    res.render("index", barsObj);
  });
});

app.get("/saved", function (req, res) {
  Article.find({ "saved": true }).populate("notes").exec(function (error, articles) {
    var barsObj = {
      article: articles
    };
    res.render("saved", barsObj);
  });
});

app.get("/scrape", function (req, res) {
  axios.get("https://www.buzzfeednews.com/").then(function (response) {
    var $ = cheerio.load(response.data);

    $("article.newsblock-story-card ").each(function (i, element) {
      var result = {};

      result.title = $(this)
        .children("a.newsblock-story-card__link").children("span.newsblock-story-card__info").children("h2")
        .text();
      result.link = $(this)
        .children("a.newsblock-story-card__link")
        .attr("href");
      result.sum = $(this)
        .children("a.newsblock-story-card__link").children("span.newsblock-story-card__info").children("p")
        .text();

      db.Article.create(result)
        .then(function (dbArticle) {
          console.log(dbArticle);
        })
        .catch(function (err) {
          console.log(err);
        });
    });

    // Send a message to the client
    res.send("Scrape Complete");
  });
});

app.get("/articles", function (req, res) {
  db.Article.find({})
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

app.get("/articles/:id", function (req, res) {
  db.Article.findOne({ _id: req.params.id })
    .populate("note")
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

app.post("/articles/save/:id", function (req, res) {
  db.Note.create(req.body)
    .then(function (dbNote) {
      return db.Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true });
    })
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

app.post("/articles/delete/:id", function (req, res) {
  db.Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": false, "notes": [] })
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

app.post("/notes/save/:id", function (req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  newNote.save(function (error, note) {
    if (error) {
      console.log(error);
    }
    else {
      db.Article.findOneAndUpdate({ "_id": req.params.id }, { $push: { "notes": note } })
        .then(function (note) {
          res.json(note);
        })
        .catch(function (err) {
          console.log(error);
          res.json(err);
        });
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function (req, res) {
  Note.findOneAndRemove({ "_id": req.params.note_id }, function (err) {
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      db.Article.findOneAndUpdate({ "_id": req.params.article_id }, { $pull: { "notes": req.params.note_id } })
        .then(function (note) {
          res.json(note);
        })
        .catch(function (err) {
          console.log(error);
          res.json(err);
        });
    }
  });
});


// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});
