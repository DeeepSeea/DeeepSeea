import { useEffect } from 'react';
import { useStore } from './store';
import { match, usePath } from './router';
import { screenName } from './lib/testExport';
import { TestBar } from './components/TestBar';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import CandidateForm from './screens/CandidateForm';
import CandidateDetail from './screens/CandidateDetail';
import FieldRecord from './screens/FieldRecord';
import Compare from './screens/Compare';
import Settings from './screens/Settings';
import { Baseline, TestPick, TestResult, TestResults, TestStart } from './screens/Test';

function route(path: string, onboarded: boolean) {
  // 처음 쓰는 사람은 기준부터 정한다. 설정과 테스트 화면은 진행자가 써야 하므로 막지 않는다
  if (!onboarded && !path.startsWith('/test') && path !== '/settings') return <Onboarding />;
  let p: Record<string, string> | null;
  if (path === '/add') return <CandidateForm key="add" />;
  if ((p = match('/c/:id/edit', path))) return <CandidateForm key={`edit-${p.id}`} editId={p.id} />;
  if ((p = match('/c/:id/record', path))) return <FieldRecord id={p.id} />;
  if ((p = match('/c/:id', path))) return <CandidateDetail key={p.id} id={p.id} />;
  if (path === '/compare') return <Compare />;
  if (path === '/settings') return <Settings />;
  if (path === '/test') return <TestStart />;
  if (path === '/test/pick') return <TestPick />;
  if (path === '/test/results') return <TestResults />;
  if (path === '/test/baseline') return <Baseline />;
  if ((p = match('/test/result/:id', path))) return <TestResult id={p.id} />;
  return <Home />;
}

export default function App() {
  const path = usePath();
  const { settings, test, logEvent } = useStore();

  useEffect(() => {
    logEvent('screen', screenName(path));
  }, [path, logEvent]);

  const showTestBar = test?.method === 'app' && !path.startsWith('/test/result');

  return (
    <div className="app-root">
      {showTestBar && <TestBar />}
      {route(path, settings.onboarded)}
    </div>
  );
}
