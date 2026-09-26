import { LocationProvider, Router, Route, lazy } from 'preact-iso';
import { Shell } from './components/Shell';
import { NotFound } from './pages/NotFound';
import { Home } from './pages/Home';
import { AllItems, ArchivePage, Favorites, Inbox, SmartView, TagPage } from './pages/Lists';
import { SpacePage } from './pages/SpacePage';

// Screens other than the lists load on first visit; every chunk is precached for offline use.
const Tasks = lazy(() => import('./pages/Tasks').then((m) => m.Tasks));
const Search = lazy(() => import('./pages/Search').then((m) => m.Search));
const Tags = lazy(() => import('./pages/Tags').then((m) => m.Tags));
const Trash = lazy(() => import('./pages/Trash').then((m) => m.Trash));
const Settings = lazy(() => import('./pages/Settings').then((m) => m.Settings));
const Stats = lazy(() => import('./pages/Stats').then((m) => m.Stats));

export function App() {
  return (
    <LocationProvider>
      <Shell>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/all" component={AllItems} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/favorites" component={Favorites} />
          <Route path="/tags" component={Tags} />
          <Route path="/view/:name" component={SmartView} />
          <Route path="/tags/:tag" component={TagPage} />
          <Route path="/s/:id" component={SpacePage} />
          <Route path="/search" component={Search} />
          <Route path="/archive" component={ArchivePage} />
          <Route path="/trash" component={Trash} />
          <Route path="/stats" component={Stats} />
          <Route path="/settings" component={Settings} />
          <Route default component={NotFound} />
        </Router>
      </Shell>
    </LocationProvider>
  );
}
