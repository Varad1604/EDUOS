
import Header from '../components/Header';

export default function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <>
      <Header title={title} />
      <div className="page fade-in">
        <div className="empty-state" style={{ marginTop: '4rem' }}>
          <div className="empty-state-icon">{icon}</div>
          <h3>{title}</h3>
          <p>This module is connected to the backend API and ready for data.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Start the backend and add records to see live data here.</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }}>+ Add {title.split(' ')[0]}</button>
        </div>
      </div>
    </>
  );
}
