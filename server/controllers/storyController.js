const db = require('../models/config')
const Story = require('../models/story')
const Line = require('../models/line')
const User = require('../models/user')

module.exports = {
  getAllStories: (req, res) => {
    if (req.query.finished === 'true') {
      Story.find({finished: true})
      .populate('lines authors')
      .then(finishedStories => {
        res.json(finishedStories)
      })
    } else {
      Story.find({})
      .then(allStories => {
        res.json(allStories)
      })
    }
  },

  getAllStoriesForSocket() {
    return Story.find({})
  },

  // this function is a middleware to make sure user is added
  // to the authors array in a story, this function is called
  // when a user
  joinStory: (req, res, next) => {
    User.findById(req.user._id)
    .then(user => {
      Story.findById(req.params.id).then(story => {
        // console.log('story here = ', story);
        // console.log('user here = ', user);
        if (story.authors.indexOf(user._id) !== -1) {
          return next();
        } else if (story.lines.length === story.length) {
          return res.status(404).send('Sorry mate- this story is already complete');
        } else {
          if (story.authors.length !== story.numberOfAuthors) {
            story.update({ $push: {authors: user._id} })
            .then(answer => {
              if (user.storiesContributedTo.indexOf(story._id) !== -1 ){
                return next();
              } else if (user.storiesCreated.indexOf(story._id) !== -1) {
                return next();
              } else {
                user.update({ $push: { storiesContributedTo: story._id} })
                .then(answer => {
                  console.log('updated')
                  return next();
                })
              }
            })
          } else {
            return res.status(404).send('This story has enough authors')
          }
        }
      })
    })
  },


  // saves a new line through a socket connection and then returns
  // a fully populated story so that the socket can update
  // the clients story state
  // called via socket to add a line to a story

  createNewLine: (lineData) => {
    return new Promise ((resolve, reject) => {
      // make a new line with user info
      const { userId, text, story } = lineData;
      Line.create({ userId, text, story })
      .then(line => {
        Story.findById(line.story).then(currentStory => {
          let finished = false;
          if (currentStory.length <= currentStory.lines.length + 1) {
            finished = true;
          }
          Story.findByIdAndUpdate(
            currentStory._id,
            { $push: { lines: line._id }, finished },
            { new: true }
          )
          .populate('authors lines')
          .then(response => {
            console.log(`\n\nStory resolved from createNewLine:\n${response}\n\n`);
            resolve(response);
          })
        })
      })
    })
  },

  // called from lobby to create a new story, will redirect them
  // to their story
  createStory: (req, res) => {
    const title = req.body.title;
    const numberOfAuthors = req.body.numberOfAuthors;
    // capture total length of the story, this is the number
    // of users multiplied by number of lines
    const length = req.body.length;
    const linesPerAuthor = req.body.linesPerAuthor;

    new Story({ title, length, numberOfAuthors, linesPerAuthor }).save()
    .then(story => {
      User.findByIdAndUpdate(req.user._id, { $push: { storiesCreated: story._id} })
      .then(answer => {
        res.json({ 'redirect': `/#/stories/${story._id}` })
      })
      .catch(err => {
        return res.status(404).send('User story list not updated')
      })
    })
    .catch(err => {
      return res.status(404).send('Story already created!')
    })
  },
  // called anytime a component mounts and needs data for a particular story
  // populate the authors and lines to give the component the complete info
  // in the story
  getOneStory: (req, res) => {
    Story.findById(req.params.id)
      .populate('authors lines')
      .then(lines => {
        console.log('lines on mount ', lines)
        res.json(lines)
      })
      .catch(err => {
        console.log('Could not find story with that id')
        return res.status(404).send('Story not found')
      })
  },

  votingFunction: (direction, story, user) => {
    Story.findById(story).then(foundStory => {
      if (direction === 'up') {
        if (foundStory.downvoters.includes(user)){
          // if user is found in downvoters, remove them, add to upvoters, and add two
          let votes = foundStory.votes += 2
          foundStory.update({ $push: { upvoters: user}, $pullAll: { downvoters: [user] }, votes }).then(finished => {
            res.json({votes})
          })
        } else if (!foundStory.upvoters.includes(user)){
          // if user is not found the upvote array, add them and add a vote
          let votes = foundStory.votes++
          foundStory.update({ $push: { upvoters: user}, votes }).then(finished => {
            res.json({votes})
          })
        } else {
          // if they are found in the upvote array, remove them and subtract a vote
          let votes = foundStory.votes--
          foundStory.update({ $pullAll: { upvoters: [user] }, votes }).then(finished => {
            res.json({votes})
          })
        }
      } else if (direction === 'down') {
        if (foundStory.upvoters.includes(user)){
          // if user is found in upvoters, remove them, add to downvoters, and subtract two
          let votes = foundStory.votes -= 2
          foundStory.update({ $push: { downvoters: user}, $pullAll: { upvoters: [user] }, votes }).then(finished => {
            res.json({votes})
          })
        } else if (!foundStory.downvoters.includes(user)){
          // if user is not found the downvote array, add them and subtract a vote
          let votes = foundStory.votes--
          foundStory.update({ $push: { downvoters: user}, votes }).then(finished => {
            res.json({votes})
          })
        } else {
          // if they are found in the downvoters array, remove them and add a vote
          let votes = foundStory.votes++
          foundStory.update({ $pullAll: { downvoters: [user] }, votes }).then(finished => {
            res.json({votes})
          })
        }

      } else {
        res.send('You can\'t vote sideways')
      }
    })
  }

};
