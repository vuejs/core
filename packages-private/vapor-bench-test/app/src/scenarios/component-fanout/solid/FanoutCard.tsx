export default function FanoutCard(props: {
  item: any
  activeId: number
  revision: number
  mode: string
}) {
  return (
    <article
      classList={{
        'fanout-card': true,
        'is-active': props.activeId === props.item.id,
        'is-busy': props.mode === 'busy',
        'is-alert': props.mode === 'alert',
      }}
    >
      <div class="fanout-title-row">
        <p class="fanout-title">{props.item.title}</p>
        <strong class="fanout-score">{props.item.score}</strong>
      </div>
      {props.activeId === props.item.id ? (
        <p class="fanout-active">active revision {props.revision}</p>
      ) : (
        <p class="fanout-meta">
          {props.item.owner} / {props.item.status}
        </p>
      )}
      <div class="fanout-badges">
        <span>{props.item.code}</span>
        <span>{props.mode}</span>
        <span>r{props.revision}</span>
      </div>
    </article>
  )
}
