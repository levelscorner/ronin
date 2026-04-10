import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

export function PageTransition({ children }: PropsWithChildren) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: 'blur(1px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(1px)' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 min-h-0 flex flex-col overflow-y-auto"
    >
      {children}
    </motion.div>
  );
}
