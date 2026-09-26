import { LocationProvider, Router, Route } from 'preact-iso';
import { Shell } from './components/Shell';
import { Placeholder } from './pages/Placeholder';
import { NotFound } from './pages/NotFound';

const page = (title: string) => () => <Placeholder title={title} />;

export function App() {
  return (
    <LocationProvider>
      <Shell>
        <Router>
          <Route path="/" component={page('Home')} />
          <Route path="/inbox" component={page('Inbox')} />
          <Route path="/all" component={page('All items')} />
          <Route path="/tasks" component={page('Tasks')} />
          <Route path="/favorites" component={page('Favorites')} />
          <Route path="/tags" component={page('Tags')} />
          <Route path="/tags/:tag" component={page('Tag')} />
          <Route path="/s/:id" component={page('Space')} />
          <Route path="/search" component={page('Search')} />
          <Route path="/archive" component={page('Archive')} />
          <Route path="/trash" component={page('Trash')} />
          <Route path="/stats" component={page('Stats')} />
          <Route path="/settings" component={page('Settings')} />
          <Route default component={NotFound} />
        </Router>
      </Shell>
    </LocationProvider>
  );
}
