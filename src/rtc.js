import { WebSocket } from 'ws'
import { EventEmitter } from 'events'

const store = await fetch('https://api.hydrus.gg/plugin/v1/@me', {
  headers: {
    authorization: `Bearer ${process.env.TOKEN}`,
  },
}).then((res) => {
  if (res.status !== 200) {
    console.error(`Authentication failed: ${res.status}`)
    process.exit(1)
  }
  return res.json()
})

const eventHandlers = new EventEmitter()

function createRTC() {
  const websocket = new WebSocket('wss://ws.hydrus.gg', {
    headers: {
      authorization: `Bearer ${process.env.TOKEN}`,
    },
  })
  websocket.on('message', (message) => {
    const { event, data } = JSON.parse(message.toString())
    eventHandlers.emit(event, data)
  })
  websocket.on('error', (error) => eventHandlers.emit('$error', error))
  websocket.on('open', () => eventHandlers.emit('$open', websocket))

  const disconnect = setTimeout(() => {
    console.log('90 seconds without a ping, check your internet connection')
    websocket.close()
  }, 90_000)

  websocket.on('ping', () => {
    disconnect.refresh()
  })

  websocket.on('close', () => {
    eventHandlers.emit('$close')
    clearTimeout(disconnect)
  })
}

createRTC()

eventHandlers.on('Channels.Denied', (channel) => {
  console.error(`Access to channel ${channel} was denied`)
  process.exit(1)
})

eventHandlers.on('Channels.Allowed', async () => {
  console.error(`Authorized as ${store.domain}`)

  const commands = []

  let page = 1

  while (true) {
    const response = await fetch(
      `https://api.hydrus.gg/plugin/v1/commands/plugin?page=${page}`,
      {
        headers: {
          authorization: `Bearer ${process.env.TOKEN}`,
        },
      }
    )

    if (response.status != 200) {
      console.error(
        'Failed to fetch pending commands %d at page %d',
        response.status,
        page
      )
      break
    }

    const body = await response.json()

    commands.push(body.data)

    if (!body.next_page_url) {
      break
    }
    page += 1
  }

  const all = commands.flat()

  console.log('Found %d pending commands', all.length)
  if (all.length) {
    eventHandlers.emit('EXECUTE_COMMANDS', all)
  }
})

eventHandlers.on('$open', (socket) => {
  socket.send(
    JSON.stringify({
      event: 'SUBSCRIBE',
      data: `Stores.${store.id}.Commands.Plugin`,
    })
  )
})

eventHandlers.on('$error', (error) => {
  console.error('WS Error [%s] %s', error.name, error.message)
})

eventHandlers.on('$close', () => {
  console.log('Disconnected from RTC, waiting 10 seconds to try again...')
  setTimeout(createRTC, 10e3)
})

export default eventHandlers
