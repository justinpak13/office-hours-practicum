import React, { ReactElement } from "react";
import { useProfile } from "../../hooks/useProfile";
import AvatarWithInitals from "./AvatarWithInitials";

type SelfAvatarProps = {
  size: number;
  style?: React.CSSProperties;
};

type KOHAvatarProps = {
  size: number;
  name: string;
  photoURL?: string;
  style?: React.CSSProperties;
  className?: string;
};

export default function SelfAvatar({
  size,
  style,
}: SelfAvatarProps): ReactElement {
  const profile = useProfile();

  return (
    <KOHAvatar
      size={size}
      name={profile?.name}
      photoURL={profile?.photoURL}
      style={style}
    />
  );
}

// The photo if there is one; the initials while it loads or if it fails
// (the shadcn Avatar handles the fallback, so no onError state is needed).
export const KOHAvatar = React.forwardRef<HTMLSpanElement, KOHAvatarProps>(
  function KOHAvatar(
    { size, name, photoURL, ...props }: KOHAvatarProps,
    ref: React.ForwardedRef<HTMLSpanElement>
  ) {
    return (
      <AvatarWithInitals
        ref={ref}
        name={name}
        size={size}
        fontSize={(3 / 7) * size}
        src={photoURL ? "/api/v1/profile/get_picture/" + photoURL : undefined}
        {...props}
      />
    );
  }
);
