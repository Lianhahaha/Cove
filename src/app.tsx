import { LocationProvider, Router, Route } from 'preact-iso';
import { Shell } from './components/Shell';
import { Placeholder } from './pages/Placeholder';
import { NotFound } from './pages/NotFound';
import { Home } from './pages/Home';
import { AllItems, ArchivePage, Favorites, Inbox, TagPage } from './pages/Lists';
import { Tags } from './pages/Tags';
import { SpacePage } from './pages/SpacePage';
import { Tasks } from './pages/Tasks';

const page = (title: string) => () => <Placeholder title={title} />;

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
          <Route path="/tags/:tag" component={TagPage} />
          <Route path="/s/:id" component={SpacePage} />
          <Route path="/search" component={page('Search')} />
          <Route path="/archive" component={ArchivePage} />
          <Route path="/trash" component={page('Trash')} />
          <Route path="/stats" component={page('Stats')} />
          <Route path="/settings" component={page('Settings')} />
          <Route default component={NotFound} />
        </Router>
      </Shell>
    </LocationProvider>
  );
}
