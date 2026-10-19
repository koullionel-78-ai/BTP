import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import SignaturePad from '../components/SignaturePad'
import { aujourdhui, dateFr } from '../lib/format'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { peutGerer, type Client, type Entreprise, type Reception as ReceptionT, type Reserve } from '../types'

interface ChantierInfo { titre: string; adresse: string | null; client_id: string | null; chef_id: string | null; statut: string }

export default function Reception() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profil, session } = useAuth()
  const gere = peutGerer(profil?.role)
  const [ch, setCh] = useState<ChantierInfo | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [pv, setPv] = useState<ReceptionT | null>(null)
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [introuvable, setIntrouvable] = useState(false)
  const [pret, setPret] = useState(false)
  // formulaire
  const [date, setDate] = useState(aujourdhui())
  const [signataire, setSignataire] = useState('')
  const [observations, setObservations] = useState('')
  const [listeReserves, setListeReserves] = useState<string[]>([''])
  const [garantie, setGarantie] = useState('')
  const [terminer, setTerminer] = useState(true)
  const [signature, setSignature] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function charger() {
    const { data: c } = await supabase.from('chantiers').select('titre, adresse, client_id, chef_id, statut').eq('id', id).maybeSingle()
    if (!c) return setIntrouvable(true)
    const info = c as ChantierInfo
    setCh(info)
    const [cl, e, r] = await Promise.all([
      info.client_id ? supabase.from('clients').select('*').eq('id', info.client_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('entreprise').select('*').eq('id', 1).maybeSingle(),
      supabase.from('receptions').select('*').eq('chantier_id', id).maybeSingle(),
    ])
    setClient(cl.data as Client | null)
    setEntreprise(e.data as Entreprise | null)
    const rec = r.data as ReceptionT | null
    setPv(rec)
    if (rec) {
      const { data } = await supabase.from('reserves').select('*').eq('reception_id', rec.id).order('levee').order('description')
      setReserves((data ?? []) as Reserve[])
    } else {
      setSignataire((s) => s || ((cl.data as Client | null)?.nom ?? ''))
      setTerminer(info.statut !== 'termine')
    }
    setPret(true)
  }
  useEffect(() => { void charger() }, [id])

  if (!profil) return null
  if (introuvable) return <p className={carte}>Chantier introuvable.</p>
  if (!pret || !ch) return <p className="text-center text-gray-500">Chargement…</p>

  const peutEcrire = gere || (profil.role === 'chef_chantier' && ch.chef_id === session?.user.id)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!signature) return setErreur('La signature du client est obligatoire.')
    if (date > aujourdhui()) return setErreur('La date ne peut pas être dans le futur.')
    const mois = garantie.trim() === '' ? 0 : nombre(garantie)
    if (Number.isNaN(mois) || mois < 0 || !Number.isInteger(mois) || mois > 240) return setErreur('La garantie doit être un nombre entier de mois (0 à 240).')
    setEnvoi(true)
    setErreur('')
    const { error } = await supabase.rpc('creer_reception', {
      p_chantier: id, p_date: date, p_observations: observations, p_signataire: signataire, p_signature: signature,
      p_reserves: listeReserves.map((r) => r.trim()).filter(Boolean), p_garantie_mois: mois, p_terminer: gere && terminer,
    })
    setEnvoi(false)
    if (error) return setErreur(error.message)
    await charger()
  }

  async function basculer(r: Reserve) {
    const levee = !r.levee
    const { error } = await supabase.from('reserves').update({ levee, levee_le: levee ? aujourdhui() : null }).eq('id', r.id)
    if (error) return setErreur(error.message)
    setErreur('')
    await charger()
  }

  async function supprimerPv() {
    if (!confirm('Supprimer ce procès-verbal, ses réserves et sa signature ? Cette action est définitive.')) return
    const { error } = await supabase.from('receptions').delete().eq('id', pv!.id)
    if (error) return setErreur(error.message)
    nav(`/chantiers/${id}`)
  }

  const restantes = reserves.filter((r) => !r.levee).length

  return (
    <div className="space-y-3">
      <div className="no-print"><Link to={`/chantiers/${id}`} className="text-sm underline">← {ch.titre}</Link></div>

      {pv ? (
        <>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button className={btn} onClick={() => window.print()}>Imprimer / PDF</button>
            {profil.role === 'gerant' && <button className="text-sm text-red-600" onClick={() => void supprimerPv()}>Supprimer le PV</button>}
          </div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <article className="impression space-y-4 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{entreprise?.nom ?? 'Mon entreprise'}</p>
                {entreprise?.adresse && <p>{entreprise.adresse}</p>}
                {entreprise?.telephone && <p>Tél. {entreprise.telephone}</p>}
                {entreprise?.identifiants && <p className="text-gray-500">{entreprise.identifiants}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold uppercase">Procès-verbal de réception</p>
                <p>Date : {dateFr(pv.date_reception)}</p>
              </div>
            </header>
            <section>
              <p className="text-xs uppercase text-gray-500">Chantier</p>
              <p className="font-semibold">{ch.titre}</p>
              {ch.adresse && <p>{ch.adresse}</p>}
              {client && <p>Client : {client.nom}</p>}
            </section>
            <p>Le client déclare réceptionner les travaux {reserves.length ? 'avec les réserves suivantes' : 'sans réserve'}.</p>
            {reserves.length > 0 && (
              <table className="w-full border-collapse">
                <thead><tr className="border-b-2 border-nuit text-left"><th className="py-1">Réserve</th><th className="py-1 text-right">État</th></tr></thead>
                <tbody>
                  {reserves.map((r) => (
                    <tr key={r.id} className="border-b border-gray-200">
                      <td className={`py-1.5 ${r.levee ? 'text-gray-400 line-through' : ''}`}>{r.description}</td>
                      <td className="py-1.5 text-right">{r.levee ? `Levée le ${dateFr(r.levee_le)}` : 'À lever'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pv.observations && <p className="whitespace-pre-line text-gray-700">{pv.observations}</p>}
            <section className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs uppercase text-gray-500">Pour l'entreprise</p>
                <div className="h-20" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Le client : {pv.signataire}</p>
                <img src={pv.signature} alt={`Signature de ${pv.signataire}`} className="h-20 object-contain" />
              </div>
            </section>
          </article>

          {reserves.length > 0 && (
            <div className={`${carte} no-print space-y-2`}>
              <h2 className="font-bold">Suivi des réserves</h2>
              <p className="text-sm">{restantes === 0 ? 'Toutes les réserves sont levées.' : `${restantes} réserve${restantes > 1 ? 's' : ''} à lever.`}</p>
              {peutEcrire ? reserves.map((r) => (
                <label key={r.id} className="flex items-center gap-2 border-t border-gray-100 pt-2 text-sm">
                  <input type="checkbox" checked={r.levee} onChange={() => void basculer(r)} />
                  <span className={r.levee ? 'text-gray-400 line-through' : ''}>{r.description}</span>
                </label>
              )) : <p className="text-sm text-gray-500">Seuls le gérant, la secrétaire et le chef du chantier peuvent marquer une réserve comme levée.</p>}
            </div>
          )}
        </>
      ) : !peutEcrire ? (
        <p className={carte}>Aucun procès-verbal de réception pour ce chantier.</p>
      ) : (
        <form onSubmit={enregistrer} className={`${carte} space-y-3`}>
          <h1 className="text-xl font-bold">Réception de chantier</h1>
          <p className="text-sm text-gray-500">{ch.titre}</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Date de réception</label><input className={champ} type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><label className={etiquette}>Nom du signataire</label><input className={champ} value={signataire} onChange={(e) => setSignataire(e.target.value)} required /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className={etiquette}>Réserves (laissez vide s'il n'y en a pas)</legend>
            {listeReserves.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className={champ} value={r} onChange={(e) => setListeReserves(listeReserves.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Ex. Retouche peinture mur est du salon" />
                {listeReserves.length > 1 && <button type="button" className="text-red-600" onClick={() => setListeReserves(listeReserves.filter((_, j) => j !== i))}>Retirer</button>}
              </div>
            ))}
            <button type="button" className={btnSec} onClick={() => setListeReserves([...listeReserves, ''])}>+ Ajouter une réserve</button>
          </fieldset>
          <div><label className={etiquette}>Observations (facultatif)</label><textarea className={champ} rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} /></div>
          {gere && (
            <>
              <div><label className={etiquette}>Garantie des travaux (mois, facultatif)</label><input className={champ} inputMode="numeric" value={garantie} onChange={(e) => setGarantie(e.target.value)} placeholder="Ex. 12 — laissez vide pour ne pas créer de garantie" /></div>
              {ch.statut !== 'termine' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={terminer} onChange={(e) => setTerminer(e.target.checked)} /> Marquer le chantier comme terminé (avancement 100 %)</label>}
            </>
          )}
          <div>
            <label className={etiquette}>Signature du client</label>
            <SignaturePad onChange={setSignature} />
          </div>
          <p className="text-xs text-gray-500">Une fois enregistré, le procès-verbal ne peut plus être modifié : seules les réserves peuvent être marquées comme levées.</p>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button className={btn} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer le procès-verbal'}</button>
        </form>
      )}
    </div>
  )
}
