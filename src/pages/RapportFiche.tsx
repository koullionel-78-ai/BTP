import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Progression from '../components/Progression'
import { dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btnSec, carte } from '../lib/ui'
import { peutGerer, type Rapport } from '../types'

const BUCKET = 'photos-chantier'
interface PhotoJour { id: string; chemin: string; url?: string }

export default function RapportFiche() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profil, session } = useAuth()
  const [r, setR] = useState<Rapport | null>(null)
  const [titre, setTitre] = useState('')
  const [auteur, setAuteur] = useState('—')
  const [presents, setPresents] = useState<string[]>([])
  const [photos, setPhotos] = useState<PhotoJour[]>([])
  const [introuvable, setIntrouvable] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('rapports').select('*, chantiers(titre)').eq('id', id).maybeSingle()
      if (!data) return setIntrouvable(true)
      const rap = data as Rapport
      setR(rap)
      setTitre(rap.chantiers?.titre ?? 'Chantier')
      const debut = new Date(rap.date_rapport + 'T00:00:00')
      const fin = new Date(debut.getTime() + 864e5)
      const [pr, au, ph] = await Promise.all([
        supabase.from('rapport_presences').select('profils(nom)').eq('rapport_id', id),
        rap.auteur_id ? supabase.from('profils').select('nom').eq('id', rap.auteur_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('photos_chantier').select('id, chemin').eq('chantier_id', rap.chantier_id)
          .gte('created_at', debut.toISOString()).lt('created_at', fin.toISOString()).order('created_at'),
      ])
      setPresents(((pr.data ?? []) as unknown as { profils: { nom: string } | null }[]).map((x) => x.profils?.nom ?? '').filter(Boolean))
      setAuteur((au.data as { nom: string } | null)?.nom ?? '—')
      const liste = (ph.data ?? []) as PhotoJour[]
      if (liste.length) {
        const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(liste.map((x) => x.chemin), 3600)
        const m = new Map((urls ?? []).map((u) => [u.path, u.signedUrl] as [string | null, string]))
        setPhotos(liste.map((x) => ({ ...x, url: m.get(x.chemin) })))
      }
    })()
  }, [id])

  if (introuvable) return <p className={carte}>Rapport introuvable.</p>
  if (!r) return <p className="text-center text-gray-500">Chargement…</p>

  const peutModifier = peutGerer(profil?.role) || r.auteur_id === session?.user.id

  async function supprimer() {
    if (!confirm('Supprimer ce rapport ?')) return
    const { error } = await supabase.from('rapports').delete().eq('id', id)
    if (error) return setMsg(error.message)
    nav('/rapports')
  }

  return (
    <div className="space-y-3">
      <Link to="/rapports" className="text-sm underline">← Rapports</Link>
      <div className={`${carte} space-y-3`}>
        <div>
          <Link to={`/chantiers/${r.chantier_id}`} className="text-xl font-bold underline">{titre}</Link>
          <p className="text-sm text-gray-500">{dateFr(r.date_rapport)} · rapport de {auteur}</p>
        </div>
        <div>
          <Progression pct={r.avancement_pct} />
          <p className="mt-1 text-sm">Avancement : <b>{r.avancement_pct} %</b></p>
        </div>
        <div><p className="text-sm text-gray-500">Travaux réalisés</p><p className="whitespace-pre-line">{r.travaux}</p></div>
        <div>
          <p className="text-sm text-gray-500">Présents ({presents.length})</p>
          <p>{presents.length ? presents.join(', ') : '—'}</p>
        </div>
        {r.incident && (
          <div className="rounded-lg bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">Incident / remarque</p>
            <p className="whitespace-pre-line text-red-900">{r.incident}</p>
          </div>
        )}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        {peutModifier && (
          <div className="flex items-center gap-3">
            <Link to={`/rapports/${id}/modifier`} className={btnSec}>Modifier</Link>
            <button className="text-sm text-red-600" onClick={() => void supprimer()}>Supprimer</button>
          </div>
        )}
      </div>
      {photos.length > 0 && (
        <div className={`${carte} space-y-2`}>
          <h2 className="font-bold">Photos du jour ({photos.length})</h2>
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg bg-gray-100">
                {p.url ? <img src={p.url} alt="Photo du chantier" loading="lazy" className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
