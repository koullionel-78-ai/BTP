import { dateFr, fcfa } from '../lib/format'
import { totaux } from '../lib/documents'
import { LIBELLE_MODE, type Client, type Devis, type Entreprise, type Facture, type Ligne, type Paiement } from '../types'

interface Props {
  type: 'devis' | 'facture'
  doc: Devis | Facture
  lignes: Ligne[]
  client: Client | null
  entreprise: Entreprise | null
  paiements?: Paiement[]
}

// Document imprimable : « Imprimer / PDF » du navigateur ne garde que ce bloc.
export default function DocumentView({ type, doc, lignes, client, entreprise, paiements = [] }: Props) {
  const t = totaux(lignes, doc.remise, doc.tva_pct)
  const facture = type === 'facture' ? (doc as Facture) : null
  const devis = type === 'devis' ? (doc as Devis) : null
  const validiteFin = devis
    ? new Date(new Date(devis.date_emission).getTime() + devis.validite_jours * 864e5).toISOString().slice(0, 10)
    : null

  return (
    <article className="impression space-y-5 rounded-2xl bg-white p-5 text-sm shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{entreprise?.nom ?? 'Mon entreprise'}</p>
          {entreprise?.adresse && <p>{entreprise.adresse}</p>}
          {entreprise?.telephone && <p>Tél. {entreprise.telephone}</p>}
          {entreprise?.email && <p>{entreprise.email}</p>}
          {entreprise?.identifiants && <p className="text-gray-500">{entreprise.identifiants}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase">{type === 'devis' ? 'Devis' : 'Facture'}</p>
          <p className="font-semibold">{doc.numero}</p>
          <p>Date : {dateFr(doc.date_emission)}</p>
          {validiteFin && <p>Valable jusqu'au {dateFr(validiteFin)}</p>}
          {facture && <p>Échéance : {dateFr(facture.date_echeance)}</p>}
        </div>
      </header>

      <section>
        <p className="text-xs uppercase text-gray-500">Client</p>
        <p className="font-semibold">{client?.nom ?? doc.client_nom}</p>
        {client?.adresse && <p>{client.adresse}</p>}
        {client?.telephone && <p>Tél. {client.telephone}</p>}
      </section>

      <p><span className="text-gray-500">Objet : </span><b>{doc.objet}</b></p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b-2 border-nuit text-left">
              <th className="py-1.5">Description</th>
              <th className="py-1.5 text-right">Qté</th>
              <th className="py-1.5 text-right">Prix unit.</th>
              <th className="py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id ?? i} className="border-b border-gray-200 align-top">
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="whitespace-nowrap py-1.5 text-right">{l.quantite} {l.unite}</td>
                <td className="whitespace-nowrap py-1.5 text-right">{fcfa(l.prix_unitaire)}</td>
                <td className="whitespace-nowrap py-1.5 text-right">{fcfa(Math.round(l.quantite * l.prix_unitaire))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto w-full max-w-xs space-y-1">
        <div className="flex justify-between"><dt>Total des lignes</dt><dd>{fcfa(t.brut)}</dd></div>
        {doc.remise > 0 && <div className="flex justify-between"><dt>Remise</dt><dd>− {fcfa(doc.remise)}</dd></div>}
        {doc.tva_pct > 0 && (
          <>
            <div className="flex justify-between"><dt>Total HT</dt><dd>{fcfa(t.ht)}</dd></div>
            <div className="flex justify-between"><dt>TVA {doc.tva_pct} %</dt><dd>{fcfa(t.tva)}</dd></div>
          </>
        )}
        <div className="flex justify-between border-t-2 border-nuit pt-1 text-base font-bold"><dt>Total à payer</dt><dd>{fcfa(t.ttc)}</dd></div>
        {facture && (
          <>
            <div className="flex justify-between"><dt>Déjà payé</dt><dd>{fcfa(facture.paye)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Reste à payer</dt><dd>{fcfa(facture.reste)}</dd></div>
          </>
        )}
      </dl>

      {facture && paiements.length > 0 && (
        <section>
          <p className="mb-1 font-semibold">Paiements reçus</p>
          {paiements.map((p) => (
            <p key={p.id} className="text-gray-600">{dateFr(p.date_paiement)} · {LIBELLE_MODE[p.mode]} · {fcfa(p.montant)}{p.reference ? ` · réf. ${p.reference}` : ''}</p>
          ))}
        </section>
      )}

      {doc.notes && <p className="whitespace-pre-line text-gray-700">{doc.notes}</p>}
      {entreprise?.conditions_paiement && <p className="whitespace-pre-line border-t border-gray-200 pt-3 text-xs text-gray-500">{entreprise.conditions_paiement}</p>}
    </article>
  )
}
