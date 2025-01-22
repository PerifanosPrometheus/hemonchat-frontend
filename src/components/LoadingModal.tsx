import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

interface LoadingModalProps {
  status: 'loading' | 'ready' | 'error'
  onClose: () => void
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }

// Game configuration constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 }
]
const GAME_SPEED = 200

export default function LoadingModal({ status, onClose }: LoadingModalProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE)
  const [food, setFood] = useState<Position>({ x: 15, y: 10 })
  const [direction, setDirection] = useState<Direction>('RIGHT')
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const generateFood = useCallback(() => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    }
    setFood(newFood)
  }, [])

  const startGame = () => {
    setSnake(INITIAL_SNAKE)
    setDirection('RIGHT')
    setScore(0)
    setGameOver(false)
    setIsPlaying(true)
    generateFood()
  }

  // Snake collision detection against walls and self
  const checkCollision = (head: Position) => {
    // Wall collision
    if (
      head.x < 0 || 
      head.x >= GRID_SIZE || 
      head.y < 0 || 
      head.y >= GRID_SIZE
    ) return true

    // Self collision
    for (const segment of snake.slice(1)) {
      if (head.x === segment.x && head.y === segment.y) return true
    }

    return false
  }

  // Main game loop - updates snake position and handles food collection
  const moveSnake = useCallback(() => {
    if (gameOver || status === 'ready' || !isPlaying) return

    setSnake(prevSnake => {
      const head = { ...prevSnake[0] }

      switch (direction) {
        case 'UP': head.y -= 1; break
        case 'DOWN': head.y += 1; break
        case 'LEFT': head.x -= 1; break
        case 'RIGHT': head.x += 1; break
      }

      if (checkCollision(head)) {
        setGameOver(true)
        return prevSnake
      }

      const newSnake = [head, ...prevSnake]
      
      // Check if food is eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 1)
        generateFood()
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [direction, food, gameOver, generateFood, status, isPlaying])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': setDirection(prev => prev !== 'DOWN' ? 'UP' : prev); break
        case 'ArrowDown': setDirection(prev => prev !== 'UP' ? 'DOWN' : prev); break
        case 'ArrowLeft': setDirection(prev => prev !== 'RIGHT' ? 'LEFT' : prev); break
        case 'ArrowRight': setDirection(prev => prev !== 'LEFT' ? 'RIGHT' : prev); break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  useEffect(() => {
    const gameInterval = setInterval(moveSnake, GAME_SPEED)
    return () => clearInterval(gameInterval)
  }, [moveSnake])

  if (status === 'ready') return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4 relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center space-y-4">
          <div className="flex justify-center items-center gap-3">
            <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full" />
          </div>
          
          <p className="text-gray-300">
            {status === 'loading' 
              ? <span className="whitespace-pre-line">
                  <span className="font-semibold text-white block mb-4 whitespace-normal">Welcome to HemonChat! 🎉</span>
                  <span className="block text-left">
                    I'm an AI specialized in hemonc.org ontology, and I'm warming up my neural networks to chat with you. This usually takes 3-5 minutes. Feel free to enjoy a game of snake while you wait, or just keep me in the background 😊
                  </span>
                </span>
              : "Unable to connect to the AI model. Please try again later."}
          </p>

          {status === 'loading' && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-6">
                <p className="text-blue-400 font-medium text-lg">Score: {score}</p>
                <button 
                  onClick={startGame}
                  className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-medium"
                >
                  {isPlaying || gameOver ? 'Reset Game' : 'Start Game'}
                </button>
              </div>
              
              <div 
                className="relative border-2 border-gray-700/50 rounded-xl overflow-hidden mx-auto shadow-lg"
                style={{ 
                  width: GRID_SIZE * CELL_SIZE, 
                  height: GRID_SIZE * CELL_SIZE,
                  backgroundColor: 'rgba(30, 41, 59, 0.5)'
                }}
              >
                {isPlaying && (
                  <>
                    {/* Food */}
                    <motion.div
                      className="absolute bg-green-500 rounded-full shadow-md"
                      style={{
                        width: CELL_SIZE - 2,
                        height: CELL_SIZE - 2,
                        left: food.x * CELL_SIZE,
                        top: food.y * CELL_SIZE,
                      }}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />

                    {/* Snake */}
                    {snake.map((segment, index) => (
                      <motion.div
                        key={index}
                        className="absolute bg-blue-500 shadow-sm"
                        style={{
                          width: CELL_SIZE - 2,
                          height: CELL_SIZE - 2,
                          left: segment.x * CELL_SIZE,
                          top: segment.y * CELL_SIZE,
                          borderRadius: index === 0 ? '8px' : '4px',
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    ))}
                  </>
                )}

                {!isPlaying && !gameOver && (
                  <div className="absolute inset-0 flex items-center justify-center text-blue-400 font-medium">
                    Click Start Game to play
                  </div>
                )}
              </div>

              {gameOver && (
                <div className="mt-4 text-red-400 font-medium">
                  Game Over! Click Reset to play again.
                </div>
              )}

              {isPlaying && (
                <div className="mt-4 text-gray-400 text-sm">
                  Use arrow keys to control the snake
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
} 