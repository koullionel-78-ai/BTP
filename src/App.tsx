import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Accueil from './pages/Accueil'
import ChantierFiche from './pages/ChantierFiche'
import ChantierForm from './pages/ChantierForm'
import Chantiers from './pages/Chantiers'
import ClientFiche from './pages/ClientFiche'
import Clients from './pages/Clients'
import Equipe from './pages/Equipe'
import Devis from './pages/Devis'
import DevisFiche from './pages/DevisFiche'
import DevisForm from './pages/DevisForm'
import FactureFiche from './pages/FactureFiche'
import FactureForm from './pages/FactureForm'
import Factures from './pages/Factures'
import InventaireFiche from './pages/InventaireFiche'
import Inventaires from './pages/Inventaires'
import ArticleFiche from './pages/ArticleFiche'
import Depenses from './pages/Depenses'
import Finances from './pages/Finances'
import Login from './pages/Login'
import Metres from './pages/Metres'
import Planning from './pages/Planning'
import Prestations from './pages/Prestations'
import RapportFiche from './pages/RapportFiche'
import RapportForm from './pages/RapportForm'
import Rapports from './pages/Rapports'
import Reception from './pages/Reception'
import Reglages from './pages/Reglages'
import Rentabilite from './pages/Rentabilite'
import Sav from './pages/Sav'
import Stock from './pages/Stock'
import Alertes from './pages/Notifications'
import Export from './pages/Export'
import Journal from './pages/Journal'
import Materiel from './pages/Materiel'
import Paie from './pages/Paie'
import Plus from './pages/Plus'
import Portfolio from './pages/Portfolio'
import Prospects from './pages/Prospects'
import SousTraitants from './pages/SousTraitants'
import Suivi from './pages/Suivi'

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/suivi/:token" element={<Suivi />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Accueil />} />
        <Route path="/chantiers" element={<Chantiers />} />
        <Route path="/chantiers/nouveau" element={<ChantierForm />} />
        <Route path="/chantiers/:id" element={<ChantierFiche />} />
        <Route path="/chantiers/:id/modifier" element={<ChantierForm />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientFiche />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/devis/nouveau" element={<DevisForm />} />
        <Route path="/devis/:id" element={<DevisFiche />} />
        <Route path="/devis/:id/modifier" element={<DevisForm />} />
        <Route path="/factures" element={<Factures />} />
        <Route path="/factures/nouvelle" element={<FactureForm />} />
        <Route path="/factures/:id" element={<FactureFiche />} />
        <Route path="/factures/:id/modifier" element={<FactureForm />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="/rapports" element={<Rapports />} />
        <Route path="/rapports/nouveau" element={<RapportForm />} />
        <Route path="/rapports/:id" element={<RapportFiche />} />
        <Route path="/rapports/:id/modifier" element={<RapportForm />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/depenses" element={<Depenses />} />
        <Route path="/chantiers/:id/metres" element={<Metres />} />
        <Route path="/chantiers/:id/reception" element={<Reception />} />
        <Route path="/sav" element={<Sav />} />
        <Route path="/prix" element={<Prestations />} />
        <Route path="/rentabilite" element={<Rentabilite />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/stock/:id" element={<ArticleFiche />} />
        <Route path="/inventaires" element={<Inventaires />} />
        <Route path="/inventaires/:id" element={<InventaireFiche />} />
        <Route path="/plus" element={<Plus />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/paie" element={<Paie />} />
        <Route path="/sous-traitants" element={<SousTraitants />} />
        <Route path="/materiel" element={<Materiel />} />
        <Route path="/prospects" element={<Prospects />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/export" element={<Export />} />
      </Route>
    </Routes>
  )
}
