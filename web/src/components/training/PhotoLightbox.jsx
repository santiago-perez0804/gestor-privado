import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { formatShortDate } from "../../lib/format.js";

export function PhotoLightbox({ photo, onClose, onDelete }) {
  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium" style={{ color: "#fff" }}>
                  {formatShortDate(photo.date)}
                </p>
                {photo.notes && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {photo.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <DeleteButton onClick={() => onDelete(photo.id)} label="Borrar foto" />
                <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1.5" style={{ color: "#fff" }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <img src={`/photos/${photo.fileName}`} alt={photo.notes || photo.date} className="w-full rounded-xl" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
