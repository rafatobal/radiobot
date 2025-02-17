const ytMusic = require('node-youtube-music').default
const Ytmp3 = require('youtube-mp3-downloader')
const Url = require('url')
const qs = require('querystring')
const fs = require('fs')
const metadater = require('./metadater')
const _path = require('path')

const directory = _path.join(__dirname, '../', 'songs/')

const isCacheSong = id => {
  try {
    return fs.existsSync(`${directory}${id}`)
  } catch (err) {
    console.error(err)
    return false
  }
}

const getSong = async (url, ctx = false) => {
  let youtubeId = false
  try {
    youtubeId = qs.parse(new Url.URL(url).search)['?v']
  } catch (_) {
    // this catch is necesary
  }
  if (!youtubeId) {
    console.log('[INFO] no video id found, looking in youtube music')
    const songs = await ytMusic.searchMusics(url)
    if (!songs.length) {
      const errMsg = 'Error: could not find song'
      console.error(errMsg)
      return Promise.reject(errMsg)
    }
    youtubeId = songs[0].youtubeId
  }

  const songFn = `${youtubeId}.mp3`

  if (isCacheSong(songFn)) {
    return Promise.resolve(`${directory}${songFn}`)
  }

  let tmpMsg
  if (ctx) tmpMsg = await ctx.reply('Looking...')

  const p = new Promise((resolve, reject) => {
    console.log('[INFO] Downloading', youtubeId)
    const yt = new Ytmp3({
      outputPath: directory
    })
    yt.download(youtubeId, songFn)
    yt.on('finished', (err, response) => {
      if (err) {
        console.error(err)
        return reject(err)
      }
      metadater(`${directory}${songFn}`).then(_ => {
        if (tmpMsg) {
          const { message_id: msgId } = tmpMsg
          ctx.deleteMessage(msgId)
        }
        resolve(`${directory}${songFn}`)
      })
    })
    yt.on('error', error => {
      console.error(error)
      reject('Cannot adquire song') // eslint-disable-line
    })
    yt.on('progress', ({ progress }) => {
      if (tmpMsg) {
        const { message_id: msgId, chat: { id: chatId } } = tmpMsg
        ctx.telegram.editMessageText(
          chatId,
          msgId,
          undefined,
          `Adquiring ${~~progress.percentage}%`
        )
      }
    })
  })
  return p
}

if (require.main === module) {
  const [,, ...input] = process.argv
  getSong(input.join(' '))
    .then(response => {
      console.log(response)
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
} else {
  module.exports = getSong
}
