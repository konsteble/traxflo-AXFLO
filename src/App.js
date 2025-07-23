import DonateButton from './components/DonateButton';

function TrackCard({ track }) {
  return (
    <div className="track-card">
      <h3>{track.title}</h3>
      <p>Исполнитель: {track.artist}</p>
      <DonateButton track={track} />
    </div>
  );
}