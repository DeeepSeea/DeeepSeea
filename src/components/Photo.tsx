import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getPhoto } from '../lib/storage';

/** IndexedDB에 저장한 사진 한 장 */
export function Photo({ id, onDelete }: { id: string; onDelete?: () => void }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    getPhoto(id)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <figure className="photo">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="현장 사진" loading="lazy" />
        </a>
      ) : (
        <div className="map__placeholder" style={{ fontSize: 12 }}>
          사진 없음
        </div>
      )}
      {onDelete && (
        <button type="button" className="photo__del" onClick={onDelete} aria-label="사진 지우기">
          <X size={16} />
        </button>
      )}
    </figure>
  );
}
