import { motion } from "framer-motion";

// Soft animated gradient blobs behind everything.
export default function Background() {
  return (
    <>
      <div className="bg-wrap" />
      <motion.div
        className="blob a"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blob b"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
