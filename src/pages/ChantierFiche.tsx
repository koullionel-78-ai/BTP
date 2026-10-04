import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/Badge'
import EspaceClientAdmin from '../components/EspaceClientAdmin'
import Progression from '../components/Progression'
import { dateFr, fcfa } from '../lib/format'
import { compresser } from '../lib/image'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ } from '../lib/ui'
import {
  LIBELLE_PHOTO, LIBELLE_STATUT, LIBELLE_TRAVAUX, peutGerer,
  type AffectationDatee, type Chantier, type ChantierFinance, type Photo, type Profil, type Rapport, type StatutChantier, type TypePhoto,
} from '../types'

const BUCKET = 'photos-chantier'
type PhotoUrl = Photo & { url?: string }

export default function ChantierFiche() {
  const { id = '' } = useParams()
  const { profil, session } = useAuth()
  const gere = peutGerer(profil?.role)
  const [ch, setCh] = useState<Chantier | null>(null)
  const [equipe, setEquipe] = useState<AffectationDatee[]>([])
  const [profils, setProfils] = useState<Profil[]>([])
  const [photos, setPhotos] = useState<PhotoUrl[]>([])
  const [filtre, setFiltre] = useState<TypePhoto | 'tous'>('tous')
  const [typeEnvoi, setTypeEnvoi] = useState<TypePhoto>('pendant')
  const [choix, setChoix] = useState('')
  const [msg, setMsg] = useState('')
  const [fin, setFin] = useState<ChantierFinance | null>(null)
  const [nbMetres, setNbMetres] = useState(0)
  const [reception, setReception] = useState<{ date_reception: string; restantes: number } | null>(null)
  const [indicatifPays, setIndicatifPays] = useState<string | undefined>()
  const [materiaux, setMateriaux] = useState<{ nom: string; unite: string; net: number }[]>([])
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [docs, setDocs] = useState<{ id: string; numero: string; type: 'devis' | 'facture'; total: number }[]>([])

  async function charger() {
    const [c, a, p, ph] = await Promise.all([
      supabase.from('chantiers').select('*, clients(nom, telephone)').eq('id', id).maybeSingle(),
      supabase.from('affectations').select('*').eq('chantier_id', id),
      supabase.from('profils').select('*').eq('actif', true).order('nom'),
      supabase.from('photos_chantier').select('*').eq('chantier_id', id).order('created_at', { ascending: false }),
    ])
    setCh(c.data as Chantier | null)
    const rp = await supabase.from('rapports').select('*').eq('chantier_id', id).order('date_rapport', { ascending: false }).limit(5)
    setRapports((rp.data ?? []) as Rapport[])
    const chantierCharge = c.data as Chantier | null
    const mt = await supabase.from('metres').select('id', { count: 'exact', head: true }).eq('chantier_id', id)
    setNbMetres(mt.count ?? 0)
    const rc = await supabase.from('receptions').select('id, date_reception').eq('chantier_id', id).maybeSingle()
    if (rc.data) {
      const rs = await supabase.from('reserves').select('id', { count: 'exact', head: true }).eq('reception_id', rc.data.id).eq('levee', false)
      setReception({ date_reception: rc.data.date_reception as string, restantes: rs.count ?? 0 })
    } else setReception(null)
    if (gere) {
      const f = await supabase.from('chantier_finances').select('*').eq('chantier_id', id).maybeSingle()
      setFin((f.data as ChantierFinance | null) ?? null)
    }
    if (chantierCharge && (gere || chantierCharge.chef_id === session?.user.id)) {
      const mv = await supabase.from('mouvements_stock').select('article_id, delta, articles(nom, unite)')
        .eq('chantier_id', id).in('type', ['sortie', 'retour'])
      const cumul = new Map<string, { nom: string; unite: string; net: number }>()
      for (const m of (mv.data ?? []) as unknown as { article_id: string; delta: number; articles: { nom: string; unite: string } | null }[]) {
        const cur = cumul.get(m.article_id) ?? { nom: m.articles?.nom ?? 'Article', unite: m.articles?.unite ?? '', net: 0 }
        cur.net += -m.delta // sortie (delta < 0) = matériel consommé, retour (delta > 0) = matériel rendu
        cumul.set(m.article_id, cur)
      }
      setMateriaux([...cumul.values()].filter((x) => x.net !== 0).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    }
    if (gere) {
      const [dv, fa] = await Promise.all([
        supabase.from('devis_totaux').select('id, numero, total_ttc').eq('chantier_id', id).order('created_at'),
        supabase.from('factures_totaux').select('id, numero, total_ttc').eq('chantier_id', id).order('created_at'),
      ])
      setDocs([
        ...((dv.data ?? []) as { id: string; numero: string; total_ttc: number }[]).map((d) => ({ id: d.id, numero: d.numero, type: 'devis' as const, total: d.total_ttc })),
        ...((fa.data ?? []) as { id: string; numero: string; total_ttc: number }[]).map((d) => ({ id: d.id, numero: d.numero, type: 'facture' as const, total: d.total_ttc })),
      ])
    }
    setEquipe((a.data ?? []) as AffectationDatee[])
    setProfils((p.data ?? []) as Profil[])
    const liste = (ph.data ?? []) as Photo[]
    if (!liste.length) return setPhotos([])
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(liste.map((x) => x.chemin), 3600)
    const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl] as [string | null, string]))
    setPhotos(liste.map((x) => ({ ...x, url: urls.get(x.chemin) })))
  }

  useEffect(() => { void charger() }, [id])
  useEffect(() => {
    if (!gere) return
    supabase.from('entreprise').select('indicatif_pays').eq('id', 1).maybeSingle().then(({ data }) => setIndicatifPays((data?.indicatif_pays as string | undefined) ?? undefined))
  }, [gere])

  const nomDe = (uid: string | null) => profils.find((p) => p.id === uid)?.nom ?? '—'

  async function changerStatut(statut: StatutChantier) {
    const maj: Partial<Chantier> = { statut }
    if (statut === 'termine' && !ch?.date_fin_reelle) maj.date_fin_reelle = new Date().toISOString().slice(0, 10)
    await supabase.from('chantiers').update(maj).eq('id', id)
    await charger()
  }

  async function affecter() {
    if (!choix) return
    const { error } = await supabase.from('affectations').insert({ chantier_id: id, utilisateur_id: choix })
    setMsg(error ? error.message : '')
    setChoix('')
    await charger()
  }

  async function majDates(a: AffectationDatee, champ: 'date_debut' | 'date_fin', valeur: string) {
    const suivant = { ...a, [champ]: valeur || null }
    if (suivant.date_debut && suivant.date_fin && suivant.date_fin < suivant.date_debut) {
      return setMsg('La date de fin doit être après la date de début.')
    }
    const { error } = await supabase.from('affectations').update({ [champ]: valeur || null }).eq('id', a.id)
    setMsg(error ? error.message : '')
    if (!error) setEquipe((l) => l.map((x) => (x.id === a.id ? suivant : x)))
  }

  async function retirer(affId: string) {
    await supabase.from('affectations').delete().eq('id', affId)
    await charger()
  }

  async function envoyer(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? [])
    const champFichier = e.target
    if (!fichiers.length || !session) return
    for (let i = 0; i < fichiers.length; i++) {
      setMsg(`Envoi ${i + 1}/${fichiers.length}…`)
      try {
        const blob = await compresser(fichiers[i])
        const chemin = `${id}/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from(BUCKET).upload(chemin, blob, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
        const ins = await supabase.from('photos_chantier').insert({ chantier_id: id, chemin, type: typeEnvoi })
        if (ins.error) throw ins.error
      } catch (err) {
        setMsg('Erreur : ' + (err as Error).message)
        champFichier.value = ''
        return
      }
    }
    champFichier.value = ''
    setMsg('')
    await charger()
  }

  async function supprimer(p: Photo) {
    if (!confirm('Supprimer cette photo ?')) return
    await supabase.from('photos_chantier').delete().eq('id', p.id)
    await supabase.storage.from(BUCKET).remove([p.chemin])
    await charger()
  }

  if (!ch) return <p className="text-center text-gray-500">Chargement…</p>

  const clientTel = ch.clients?.telephone ?? null
  const disponibles = profils.filter((p) => !equipe.some((a) => a.utilisateur_id === p.id))
  const photosAffichees = photos.filter((p) => filtre === 'tous' || p.type === filtre)

  return (
    <div className="space-y-4">
      <Link to="/chantiers" className="text-sm underline">← Chantiers</Link>
      <div className={`${carte} space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{ch.titre}</h1>
            <p className="text-sm text-gray-500">{ch.clients?.nom ?? 'Client non renseigné'} · {LIBELLE_TRAVAUX[ch.type_travaux]}</p>
          </div>
          <Badge statut={ch.statut} />
        </div>
        <Progression pct={ch.avancement_pct} />
        <p className="text-sm">Avancement : <b>{ch.avancement_pct} %</b></p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-gray-500">Adresse</dt><dd>{ch.adresse ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Chef de chantier</dt><dd>{nomDe(ch.chef_id)}</dd></div>
          <div><dt className="text-gray-500">Début</dt><dd>{dateFr(ch.date_debut)}</dd></div>
          <div><dt className="text-gray-500">Fin prévue</dt><dd>{dateFr(ch.date_fin_prevue)}</dd></div>
          {gere && <div><dt className="text-gray-500">Budget prévu</dt><dd>{fcfa(ch.budget_prevu)}</dd></div>}
          {ch.date_fin_reelle && <div><dt className="text-gray-500">Fin réelle</dt><dd>{dateFr(ch.date_fin_reelle)}</dd></div>}
        </dl>
        {gere && (
          <div className="flex gap-2">
            <select className={champ} value={ch.statut} onChange={(e) => void changerStatut(e.target.value as StatutChantier)} aria-label="Statut">
              {Object.entries(LIBELLE_STATUT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Link to={`/chantiers/${id}/modifier`} className={btnSec}>Modifier</Link>
          </div>
        )}
      </div>

      {gere && (
        <div className={`${carte} space-y-2`}>
          <h2 className="font-bold">Devis et factures ({docs.length})</h2>
          {docs.map((d) => (
            <Link key={d.type + d.id} to={`/${d.type === 'devis' ? 'devis' : 'factures'}/${d.id}`} className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
              <span>{d.numero}</span><b>{fcfa(d.total)}</b>
            </Link>
          ))}
          {!docs.length && <p className="text-sm text-gray-500">Aucun document pour ce chantier.</p>}
          <div className="flex gap-2 pt-1">
            <Link to={`/devis/nouveau?client=${ch.client_id ?? ''}&chantier=${id}`} className={btnSec}>Nouveau devis</Link>
            <Link to={`/factures/nouvelle?client=${ch.client_id ?? ''}&chantier=${id}`} className={btnSec}>Nouvelle facture</Link>
          </div>
        </div>
      )}

      {(reception || gere || ch.chef_id === session?.user.id) && (
        <div className={`${carte} space-y-1`}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Réception</h2>
            <Link to={`/chantiers/${id}/reception`} className="text-sm underline">{reception ? 'Voir le PV' : 'Enregistrer la réception'}</Link>
          </div>
          {reception ? (
            <p className="text-sm">Réceptionné le {dateFr(reception.date_reception)} · {reception.restantes === 0 ? 'aucune réserve à lever' : `${reception.restantes} réserve${reception.restantes > 1 ? 's' : ''} à lever`}</p>
          ) : <p className="text-sm text-gray-500">Procès-verbal non encore établi.</p>}
        </div>
      )}

      {gere && <EspaceClientAdmin chantierId={id} titre={ch.titre} clientNom={ch.clients?.nom} clientTel={clientTel} indicatif={indicatifPays} />}

      <div className={`${carte} space-y-2`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Métrés ({nbMetres})</h2>
          <Link to={`/chantiers/${id}/metres`} className="text-sm underline">{nbMetres ? 'Voir et ajouter' : 'Commencer les métrés'}</Link>
        </div>
      </div>

      {gere && fin && (
        <div className={`${carte} space-y-2`}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Finances du chantier</h2>
            <Link to={`/depenses?chantier=${id}`} className="text-sm underline">Ajouter une dépense</Link>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Budget prévu</dt><dd>{fin.budget_prevu > 0 ? fcfa(fin.budget_prevu) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Facturé</dt><dd>{fcfa(fin.facture)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Encaissé</dt><dd>{fcfa(fin.encaisse)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Dépenses</dt><dd className={fin.budget_prevu > 0 && fin.depenses > fin.budget_prevu ? 'font-bold text-red-600' : ''}>{fcfa(fin.depenses)}</dd></div>
            {fin.facture > 0 && <div className="flex justify-between border-t border-gray-100 pt-1 font-bold"><dt>Marge (facturé − dépenses)</dt><dd className={fin.facture - fin.depenses < 0 ? 'text-red-600' : 'text-green-700'}>{fin.facture - fin.depenses < 0 ? '− ' : ''}{fcfa(Math.abs(fin.facture - fin.depenses))}</dd></div>}
          </dl>
        </div>
      )}

      {(gere || ch.chef_id === session?.user.id) && (
        <div className={`${carte} space-y-2`}>
          <h2 className="font-bold">Matériaux utilisés</h2>
          {materiaux.map((m) => (
            <div key={m.nom} className="flex justify-between border-t border-gray-100 pt-2 text-sm">
              <span>{m.nom}</span><b>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(m.net)} {m.unite}</b>
            </div>
          ))}
          {!materiaux.length && <p className="text-sm text-gray-500">Aucune sortie de stock pour ce chantier.</p>}
        </div>
      )}

      <div className={`${carte} space-y-2`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Derniers rapports</h2>
          {(gere || ch.chef_id === session?.user.id) && <Link to={`/rapports/nouveau?chantier=${id}`} className="text-sm underline">Nouveau rapport</Link>}
        </div>
        {rapports.map((r) => (
          <Link key={r.id} to={`/rapports/${r.id}`} className="block border-t border-gray-100 pt-2 text-sm">
            <span className="font-semibold">{dateFr(r.date_rapport)}</span> · {r.avancement_pct} %
            {r.incident && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Incident</span>}
            <span className="block truncate text-gray-500">{r.travaux}</span>
          </Link>
        ))}
        {!rapports.length && <p className="text-sm text-gray-500">Aucun rapport pour l'instant.</p>}
      </div>

      <div className={`${carte} space-y-2`}>
        <h2 className="font-bold">Équipe affectée ({equipe.length})</h2>
        {equipe.map((a) => (
          <div key={a.id} className="space-y-1 border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between">
              <span>{nomDe(a.utilisateur_id)}</span>
              {gere && <button className="text-sm text-red-600" onClick={() => void retirer(a.id)}>Retirer</button>}
            </div>
            {gere ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <label>Du<input type="date" className={`${champ} !py-1.5`} value={a.date_debut ?? ''} onChange={(e) => void majDates(a, 'date_debut', e.target.value)} /></label>
                <label>Au<input type="date" className={`${champ} !py-1.5`} value={a.date_fin ?? ''} onChange={(e) => void majDates(a, 'date_fin', e.target.value)} /></label>
              </div>
            ) : (
              (a.date_debut || a.date_fin) && <p className="text-xs text-gray-500">{dateFr(a.date_debut)} → {dateFr(a.date_fin)}</p>
            )}
          </div>
        ))}
        {!equipe.length && <p className="text-sm text-gray-500">Personne d'affecté pour l'instant.</p>}
        {gere && (
          <div className="flex gap-2 pt-1">
            <select className={champ} value={choix} onChange={(e) => setChoix(e.target.value)} aria-label="Personne à affecter">
              <option value="">Choisir une personne…</option>
              {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <button className={btn} onClick={() => void affecter()}>Affecter</button>
          </div>
        )}
      </div>

      <div className={`${carte} space-y-3`}>
        <h2 className="font-bold">Photos ({photos.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${champ} !w-auto`} value={typeEnvoi} onChange={(e) => setTypeEnvoi(e.target.value as TypePhoto)} aria-label="Type de photo à envoyer">
            {Object.entries(LIBELLE_PHOTO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className={`${btn} cursor-pointer`}>
            Ajouter des photos
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void envoyer(e)} />
          </label>
        </div>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
        <div className="flex gap-2">
          {(['tous', 'avant', 'pendant', 'apres'] as const).map((f) => (
            <button key={f} onClick={() => setFiltre(f)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-gray-100'}`}>
              {f === 'tous' ? 'Toutes' : LIBELLE_PHOTO[f]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {photosAffichees.map((p) => (
            <figure key={p.id} className="relative overflow-hidden rounded-lg bg-gray-100">
              {p.url ? <img src={p.url} alt={`Photo ${LIBELLE_PHOTO[p.type]}`} loading="lazy" className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
              <figcaption className="absolute left-1 top-1 rounded bg-nuit/80 px-2 py-0.5 text-xs text-white">{LIBELLE_PHOTO[p.type]}</figcaption>
              {(gere || p.auteur_id === session?.user.id) && (
                <button onClick={() => void supprimer(p)} className="absolute right-1 top-1 rounded bg-white/90 px-2 py-0.5 text-xs text-red-600">Supprimer</button>
              )}
            </figure>
          ))}
        </div>
        {!photosAffichees.length && <p className="text-sm text-gray-500">Aucune photo.</p>}
      </div>
    </div>
  )
}
