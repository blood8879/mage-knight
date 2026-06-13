import { Children, isValidElement } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedListProps {
  children: ReactNode
  className?: string
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      type: 'spring' as const,
      damping: 22,
      stiffness: 320,
    },
  }),
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.15 },
  },
}

function getChildKey(child: ReactNode, index: number): string | number {
  if (isValidElement(child) && child.key != null) {
    return child.key
  }
  return index
}

export default function AnimatedList({ children, className }: AnimatedListProps) {
  const items = Children.toArray(children)

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {items.map((child, i) => (
          <motion.div
            key={getChildKey(child, i)}
            layout
            custom={i}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
