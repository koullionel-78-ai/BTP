import { useEffect, useRef, useState } from 'react'

interface Props {
  onChange: (png: string | null) => void
}

const LARGEUR = 600
const HAUTEUR = 220

// Zone de signature au doigt ou à la souris (événements « pointer » : téléphone et ordinateur)
export default function SignaturePad({ onChange }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dessin = useRef(false)
  const [vide, setVide] = useState(true)

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * LARGEUR) / r.width, y: ((e.clientY - r.top) * HAUTEUR) / r.height }
  }

  function debut(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    ref.current!.setPointerCapture(e.pointerId)
    const ctx = ref.current!.getContext('2d')!
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.1, p.y + 0.1) // un simple appui laisse un point
    ctx.stroke()
    dessin.current = true
  }

  function trace(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessin.current) return
    e.preventDefault()
    const ctx = ref.current!.getContext('2d')!
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function fin() {
    if (!dessin.current) return
    dessin.current = false
    setVide(false)
    onChange(ref.current!.toDataURL('image/png'))
  }

  function effacer() {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setVide(true)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={LARGEUR}
        height={HAUTEUR}
        className="w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white"
        style={{ aspectRatio: `${LARGEUR} / ${HAUTEUR}` }}
        onPointerDown={debut}
        onPointerMove={trace}
        onPointerUp={fin}
        onPointerCancel={fin}
        aria-label="Zone de signature"
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{vide ? 'Signez dans le cadre ci-dessus.' : 'Signature enregistrée dans le formulaire.'}</span>
        <button type="button" className="underline" onClick={effacer}>Effacer</button>
      </div>
    </div>
  )
}
