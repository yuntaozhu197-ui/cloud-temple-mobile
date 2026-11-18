import "./loading.css";

type LoadingStage = "session" | "enter" | "world";

type Props = {
  stage: LoadingStage;
};

const messages: Record<LoadingStage, string> = {
  session: "正在叩响山门…",
  enter: "正在为你引路…",
  world: "正在准备山中庭院…",
};

export default function TempleLoading({ stage }: Props) {
  return <div className="temple-loading" role="status" aria-live="polite" aria-atomic="true">
    <div className="temple-loading-composition" aria-hidden="true">
      <div className="temple-loading-halo" />
      <div className="temple-loading-orbit"><i /><i /><i /></div>
      <div className="temple-loading-flower">
        <span className="temple-loading-petal petal-back-left" />
        <span className="temple-loading-petal petal-back-right" />
        <span className="temple-loading-petal petal-middle-left" />
        <span className="temple-loading-petal petal-middle-right" />
        <span className="temple-loading-petal petal-heart" />
        <span className="temple-loading-petal petal-front-left" />
        <span className="temple-loading-petal petal-front-right" />
        <span className="temple-loading-seed" />
      </div>
      <div className="temple-loading-water"><span /><span /><span /></div>
    </div>
    <p className="temple-loading-brand heading-4">云间寺</p>
    <p className="temple-loading-message body-5">{messages[stage]}</p>
    <div className="temple-loading-breath" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
