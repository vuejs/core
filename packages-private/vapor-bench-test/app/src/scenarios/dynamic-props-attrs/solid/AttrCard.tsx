export default function AttrCard(props: any) {
  return (
    <article
      aria-label={props['aria-label']}
      class={`attrs-card ${props.class} ${
        props.active ? 'is-active' : ''
      } ${props.compact ? 'is-compact' : ''} tone-${props.tone}`}
      data-owner={props['data-owner']}
      data-rank={props['data-rank']}
      data-revision={props['data-revision']}
      style={props.style}
      title={props.title}
    >
      <div class="attrs-title-row">
        <p class="attrs-title">{props.item.title}</p>
        <strong class="attrs-score">{props.item.score}</strong>
      </div>
      {props.active ? (
        <p class="attrs-active">active attr revision {props.revision}</p>
      ) : (
        <p class="attrs-meta">
          {props.item.owner} / {props.item.status}
        </p>
      )}
      <div class="attrs-badges">
        <span>{props.item.code}</span>
        <span>{props.tone}</span>
        <span>r{props.revision}</span>
      </div>
    </article>
  )
}
