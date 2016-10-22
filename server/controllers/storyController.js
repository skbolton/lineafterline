const db = require('../models/config')
const Story = require('../models/story')
const Line = require('../models/line')
const User = require('../models/user')

module.exports = {
  getAllStories: (req, res) => {
    Story.find({complete: false, $where: 'this.users.length < this.numberUsers'})
    .then((stories) => {
      console.log('~~~~~~~~~',req.user)
      res.json(stories)
    })
  },

  joinStory: (req, res, next) => {
    console.log(req.user)
    User.findOne({facebookId: req.user.facebookId})
    .then(user => {
      Story.findOne({_id: req.params.id}).then(story => {
        if(story.users.indexOf(user.facebookId) !== -1) {
          return next()
        } else if(story.complete) {
          return res.status(404).send('Sorry mate- this story is already complete')
        } else {
          story.update({ $push: {users: user.facebookId}})
          .then(story => {
            console.log('updated')
            return next()
          })
        }
      })
    })
  },
  createNewLine: (lineData) => {
    return new Promise(function(resolve, reject) {
      Story.findOne({_id: lineData.story}) // Find the story that they are trying to add the line to
      .then((story) => {
        if(!story.completed){
          User.findOne({facebookId: lineData.userId}) // Find current user
          .then((user) => {
            new Line({userId: user.facebookId, story: lineData.story, text: lineData.text}).save() // Create the new line and associate it with the user and story
            .then((line) => {
              story.update({ $push: { lines: line._id }, $inc: { currentLine: 1}})
              .then(()=> {
                if(story.lines.length >= story.length) {
                  story.update({complete: true})
                  .then(()=>{
                    resolve(line)
                  })
                } else {
                  resolve(line)
                }
              })
            })
            .catch((err) => {
              console.log(err)
            })
          })
        } else {
          res.status(400).send('Story already complete')
        }
      })
    })
  },
  createStory: (req, res) => {
    console.log(req.body)
    const length = req.body.storyLength * 1
    const title = req.body.title
    const numberUsers = req.body.numberUsers * 1

    console.log(req.user)
    User.findOne({facebookId: req.user.facebookId})
    .then((user)=>{
      new Story({title: title, length: length, users: [], numberUsers: numberUsers }).save()
      .then((story) => {
        console.log("Story saved: ", story)
        res.json({"redirect":`http://localhost:8081/#/stories/${story._id}`})
      })
      .catch((err) => {
        return res.status(404).send('Story already created!')
      })
    })
    .catch((err) => {
      console.log('Could not find user with that session')
      return res.status(404).send('User not found')
    })

  },
  getOneStory: (req, res) => {
    console.log(req.params)
    Story.findOne({_id: req.params.id})
    .then((story) => {
      if(story.lines.length){
        Promise.all(story.lines.map(lineid =>
          Line.findOne({_id: lineid})
        ))
        .then((data) => {
          story.lines = data
          console.log(story)
          res.json(story)
        })
      } else {
        res.json(story)
      }
    })
    .catch((err) => {
      console.log('Could not find story with that id')
      return res.status(404).send('Story not found')
    })
  }
};
