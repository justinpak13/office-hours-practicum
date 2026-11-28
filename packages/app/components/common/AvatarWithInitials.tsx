import React from "react";
import nameToRGB from "../../utils/ColorUtils";
import getInitialsFromName from "../../utils/NameUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarWithInitalsProps = Omit<
  React.ComponentPropsWithoutRef<typeof Avatar>,
  "children"
> & {
  name: string;
  /** Width and height in px. antd's default was 32. */
  size?: number;
  fontSize?: number;
  /** Photo URL. The initials show while it loads, or if it fails. */
  src?: string;
};

// A round avatar with the person's initials on a color picked from their name.
// Forwards its ref and props, so tooltips and popovers can wrap it.
const AvatarWithInitals = React.forwardRef<
  React.ElementRef<typeof Avatar>,
  AvatarWithInitalsProps
>(function AvatarWithInitals(
  {
    name,
    size = 32,
    fontSize = 14,
    src,
    style,
    className,
    ...props
  }: AvatarWithInitalsProps,
  ref: React.ForwardedRef<React.ElementRef<typeof Avatar>>
) {
  return (
    <Avatar
      ref={ref}
      // inline-flex + align-middle: antd's avatar was inline-block, middle-aligned
      className={cn("inline-flex align-middle", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {src && <AvatarImage src={src} alt={name} className="object-cover" />}
      <AvatarFallback
        className="whitespace-nowrap text-white"
        style={{
          backgroundColor: name ? nameToRGB(name) : "#1abc9c",
          fontSize,
        }}
      >
        {getInitialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
});

export default AvatarWithInitals;
