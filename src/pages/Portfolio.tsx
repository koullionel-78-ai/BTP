import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { peutGerer } from '../types'

const BUCKET = 'photos-chantier'
interface Photo { id: string; chantier_id: string; chemin: string; type: 'avant' | 'apres' }
interface Entree { id: string; chantier_id: string; titre: string; description: string | null }

export default function Portfolio() {
  const { profil } = useAuth()
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [entreprise, setEntreprise] = useState('')
  const [edition, setEdition] = useState<string | null>(null)
  const [titre, setTitre] = useState(''); const [description, setDescription] = useState('')
  const [pret, setPret] = useState(false)
  const [msg, setMsg] = useState('')

  async function charger() {
    const [p, ph, c, e] = await Promise.all([
      supabase.from('portfolio').select('*').order('created_at', { ascending: false }),
      supabase.from('photos_chantier').select('id, chantier_id, chemin, type').in('type', ['avant', 'apres']).order('created_at').limit(2000),
      supabase.from('chantiers').select('id, titre').order('titre'),
      supabase.from('entreprise').select('nom').eq('id', 1).maybeSingle(),
    ])
    const err = p.error ?? ph.error ?? c.error
    if (err) setMsg(err.message)
    const listePhotos = (ph.data ?? []) as Photo[]
    setEntrees((p.data ?? []) as Entree[])
    setPhotos(listePhotos)
    setChantiers((c.data ?? []) as { id: string; titre: string }[])
    setEntreprise((e.data?.nom as string | undefined) ?? '')
    // vignettes : une photo « avant » et une « après » par chantier
    const choisies = new Map<string, Photo>()
    for (const x of listePhotos) if (!choisies.has(`${x.chantier_id}|${x.type}`)) choisies.set(`${x.chantier_id}|${x.type}`, x)
    const chemins = [...choisies.values()].map((x) => x.chemin)
    if (chemins.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(chemins, 3600)
      setUrls(new Map((data ?? []).map((u) => [u.path ?? '', u.signedUrl] as [string, string])))
    }
    setPret(true)
  }
  useEffect(() => { void charger() }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const premiere = (cid: string, type: 'avant' | 'apres') => photos.find((x) => x.chantier_id === cid && x.type === type)
  const titreDe = (cid: string) => chantiers.find((c) => c.id === cid)?.titre ?? 'Chantier'
  const dejaPublies = new Set(entrees.map((e) => e.chantier_id))
  const candidats = chantiers.filter((c) => !dejaPublies.has(c.id) && premiere(c.id, 'avant') && premiere(c.id, 'apres'))

  function Vignettes({ cid }: { cid: string }) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(['avant', 'apres'] as const).map((t) => {
          const p = premiere(cid, t)
          const u = p ? urls.get(p.chemin) : undefined
          return (
            <div key={t} className="relative overflow-hidden rounded-lg bg-gray-100">
              {u ? <img src={u} alt={t === 'avant' ? 'Avant travaux' : 'Après travaux'} loading="lazy" className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">{t === 'avant' ? 'Avant' : 'Après'}</span>
            </div>
          )
        })}
      </div>
    )
  }

  async function ajouter(cid: string) {
    const { error } = await supabase.from('portfolio').insert({ chantier_id: cid, titre: titreDe(cid) })
    setMsg(error ? error.message : '')
    await charger()
  }

  async function enregistrer(e: FormEvent, en: Entree) {
    e.preventDefault()
    const { error } = await supabase.from('portfolio').update({ titre: titre.trim(), description: description.trim() || null }).eq('id', en.id)
    if (error) return setMsg(error.message)
    setEdition(null); setMsg('')
    await charger()
  }

  async function retirer(en: Entree) {
    if (!confirm(`Retirer « ${en.titre} » du portfolio ? Les photos restent sur le chantier.`)) return
    const { error } = await supabase.from('portfolio').delete().eq('id', en.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  // Les photos sont privées : on partage des liens valables 7 jours.
  async function partager(en: Entree) {
    const avant = premiere(en.chantier_id, 'avant'); const apres = premiere(en.chantier_id, 'apres')
    if (!avant || !apres) return setMsg('Il faut une photo « avant » et une photo « après » sur ce chantier.')
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls([avant.chemin, apres.chemin], 7 * 24 * 3600)
    if (error || !data) return setMsg(error?.message ?? 'Impossible de créer les liens.')
    const lien = (chemin: string) => data.find((d) => d.path === chemin)?.signedUrl ?? ''
    const texte = [
      `*${en.titre}*`, en.description ?? '', `Avant : ${lien(avant.chemin)}`, `Après : ${lien(apres.chemin)}`,
      entreprise ? `— ${entreprise}` : '',
    ].filter(Boolean).join('\n')
    setMsg('')
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank', 'noopener')
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Portfolio</h1>
      <p className="text-sm text-gray-500">Vos réalisations avant / après, à montrer aux prospects. Les liens partagés sur WhatsApp restent valables 7 jours.</p>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {!pret && <p className="text-center text-gray-500">Chargement…</p>}

      {entrees.map((en) => (
        <div key={en.id} className={`${carte} space-y-2`}>
          <Vignettes cid={en.chantier_id} />
          {edition === en.id ? (
            <form onSubmit={(e) => void enregistrer(e, en)} className="space-y-2">
              <div><label className={etiquette}>Titre</label><input className={champ} value={titre} onChange={(e) => setTitre(e.target.value)} required /></div>
              <div><label className={etiquette}>Description</label><textarea className={champ} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Rénovation complète d'un salon, peinture acrylique" /></div>
              <div className="flex gap-2"><button className={btn}>Enregistrer</button><button type="button" className={btnSec} onClick={() => setEdition(null)}>Annuler</button></div>
            </form>
          ) : (
            <>
              <p className="font-semibold">{en.titre}</p>
              {en.description && <p className="text-sm text-gray-600">{en.description}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button className={btn} onClick={() => void partager(en)}>Partager sur WhatsApp</button>
                <button className="text-sm underline" onClick={() => { setEdition(en.id); setTitre(en.titre); setDescription(en.description ?? '') }}>Modifier</button>
                <Link to={`/chantiers/${en.chantier_id}`} className="text-sm underline">Chantier</Link>
                <button className="ml-auto text-sm text-red-600" onClick={() => void retirer(en)}>Retirer</button>
              </div>
            </>
          )}
        </div>
      ))}

      {candidats.length > 0 && <h2 className="pt-2 font-bold">Prêts à publier ({candidats.length})</h2>}
      {candidats.map((c) => (
        <div key={c.id} className={`${carte} space-y-2`}>
          <Vignettes cid={c.id} />
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{c.titre}</p>
            <button className={btnSec} onClick={() => void ajouter(c.id)}>Ajouter au portfolio</button>
          </div>
        </div>
      ))}
      {pret && !entrees.length && !candidats.length && (
        <p className="text-center text-gray-500">Aucune réalisation pour l'instant. Ajoutez une photo « avant » et une photo « après » sur la fiche d'un chantier.</p>
      )}
    </div>
  )
}
