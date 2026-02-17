require("dotenv").config()
const express = require("express")
const app = express()

app.use(express.json())

const stockHistory = new Map()
const watches = new Map()

app.post('/start-monitoring', async (req, res) => {
    const { symbol, minutes, seconds } = req.body
    
    // Check fields are not empty
    if (!symbol || minutes === undefined || seconds === undefined) {
        return res.status(400).json({
            error: "Inputs cannot be empty"
        })
    }

    // Check min/sec are number
    if (isNaN(minutes) || isNaN(seconds)) {
        return res.status(400).json({
            error: "Minutes or seconds must be a number"
        })
    }

    // Check min and sec are positive
    if (minutes < 0 || seconds < 0) {
        return res.status(400).json({
            error: "Minutes or seconds must be positive"
        })
    }

    // Check interval is not 0
    if (minutes === 0 && seconds === 0) {
        return res.status(400).json({ error: "Interval cannot be 0" })
    }

    // User cannot watch a stock that's already being monitored
    if (watches.has(symbol)) {
        return res.status(400).json({ error: `You are already watching ${symbol} stock` })
    }

    // Convert min + sec into ms
    const time = (minutes * 60 + seconds) * 1000

    // Before interval ensure stock exists
    try {
        const entry = await fetchStock(symbol)

        if (!stockHistory.has(symbol)) {
            stockHistory.set(symbol, [entry])
        } else {
            stockHistory.get(symbol).push(entry)
        }
    } catch (error) {
        console.error(error)
        return res.json({ error: error.message })
    }

    // Assign interval to var to identify in Map
    const watch = setInterval(async () => {
        try {
            const entry = await fetchStock(symbol)

            if (!stockHistory.has(symbol)) {
                stockHistory.set(symbol, [entry])
            } else {
                stockHistory.get(symbol).push(entry)
            }
        } catch (error) {
            console.error(error)
            clearInterval(watch)
        }
        }, time)

    // Monitor stock
    watches.set(symbol, watch)
    return res.status(200).json({ message: `Started monitoring ${symbol}` })
})

app.get('/history', (req, res) => {
    const stock = req.query.symbol
    return res.json({
        stock,
        history: stockHistory.get(stock) || []
    })
})

app.post("/refresh", async (req, res) => {
    const { symbol } = req.body

    if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" })
    }
    
    try {
        const entry = await fetchStock(symbol)

        if (!stockHistory.has(symbol)) {
            stockHistory.set(symbol, [entry])
        } else {
            stockHistory.get(symbol).push(entry)
        }

        return res.status(200).json(entry)
    } catch (error) {
        console.error(error)
        return res.json({ error: error.message })
    }
})

app.post("/stop-watch", (req, res) => {
    const { symbol } = req.body

    if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" })
    }

    if (watches.has(symbol)) {
        clearInterval(watches.get(symbol))
        watches.delete(symbol)
        return res.status(200).json({ message: `Stopped watching ${symbol}` })
    } else {
        return res.status(404).json({ error: `Could not find watch for ${symbol}` })
    }
})

async function fetchStock(symbol) {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.API_KEY}`)
    
    if (!response.ok) throw new Error(`Failed to fetch ${symbol}`)
    
    const data = await response.json()
    
    if (data.c === 0) throw new Error(`Stock ${symbol} does not exist or has no data`)
    
    return {
        "Open Price": `$${data.o}`,
        "High Price": `$${data.h}`,
        "Low Price": `$${data.l}`,
        "Current Price": `$${data.c}`,
        "Previous Close Price": `$${data.pc}`,
        "Time": getNow()
    }
}

// Gets today's date and time
function getNow() {
  const now = new Date()
  const date = now.toLocaleDateString()
  const time = now.toLocaleTimeString()
  
  return `${date} at ${time}`
}

app.listen(3000, () => {
    console.log('Listening on Port 3000')
})