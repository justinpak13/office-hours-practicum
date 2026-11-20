import React, { useEffect, useState, ReactElement } from "react";
import { Link } from "lucide-react";
import styled from "styled-components";

// lucide has no brand icons, so this is the LinkedIn logo antd used, inline.
function LinkedinIcon(props: React.SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="64 64 896 896"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zM349.3 793.7H230.6V411.9h118.7v381.8zm-59.3-434a68.8 68.8 0 1168.8-68.8c-.1 38-30.9 68.8-68.8 68.8zm503.7 434H675.1V608c0-44.3-.8-101.2-61.7-101.2-61.7 0-71.2 48.2-71.2 98v188.9H423.7V411.9h113.8v52.2h1.6c15.8-30 54.5-61.7 112.3-61.7 120.2 0 142.3 79.1 142.3 181.9v209.4z" />
    </svg>
  );
}

// Styled components
const StyledCard = styled.div`
  margin: 7px;
  position: relative;
  overflow: hidden;
  cursor: auto;
  width: 200px;
  height: 270px;
  border: 1px solid #f0f0f0;
  color: rgba(0, 0, 0, 0.65);
  font-size: 14px;
  background: #fff;
  border-radius: 2px;
  transition: box-shadow 0.3s, border-color 0.3s;

  &:hover {
    border-color: transparent;
    box-shadow: 0 1px 2px -2px rgb(0 0 0 / 16%), 0 3px 6px 0 rgb(0 0 0 / 12%),
      0 5px 12px 4px rgb(0 0 0 / 9%);
  }
`;

const CardContents = styled.div`
  color: #5f6b79;
  font-size: 14px;
  padding: 10px 20px;
  height: 100%;
  width: 100%;
  background-color: white;
  border-radius: 8px;
  z-index: 2;
  position: absolute;
  top: 192px;
  transition: top 0.5s;

  ${StyledCard}:hover & {
    top: 130px;
  }
`;

const CardTitle = styled.div`
  font-weight: 600;
  color: #2a426b;
  font-size: 16px;
`;

const ImageOverlay = styled.div`
  width: 200px;
  height: 200px;
  z-index: 1;
  position: absolute;
  top: 0px;
  background-color: #2a426b;
  opacity: 0;
  transition: opacity 0.3s;

  ${StyledCard}:hover & {
    opacity: 0.8;
  }
`;

const LinkIcons = styled.div`
  position: absolute;
  top: 75px;
  color: #2a426b;
  font-size: 34px;
  display: flex;
  align-items: center;
`;

const NavyLink = styled.a`
  margin-right: 10px;
  color: #2a426b;
  &:hover {
    color: #2a426b;
  }
`;

// Function to generate initials image
const generateInitialsImage = (name: string): string => {
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#2a426b"; // Background color
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff"; // Text color
    context.font = "bold 80px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initials, canvas.width / 2, canvas.height / 2);
  }

  return canvas.toDataURL();
};

interface ProfileCardProps {
  name: string;
  role: string;
  linkedin?: string;
  personalSite?: string;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  role,
  linkedin,
  personalSite,
}): ReactElement => {
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    const initialsImage = generateInitialsImage(name);
    setImgSrc(initialsImage);
  }, [name]);

  return (
    <StyledCard>
      <img width={200} alt={`${name}'s profile`} src={imgSrc} />
      <ImageOverlay />
      <CardContents>
        <CardTitle>{name}</CardTitle>
        <div>{role}</div>
        <LinkIcons>
          {linkedin && (
            <NavyLink
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn"
              aria-label="LinkedIn"
            >
              <LinkedinIcon className="inline-block cursor-pointer align-[-0.125em]" />
            </NavyLink>
          )}
          {personalSite && (
            <NavyLink
              href={personalSite}
              target="_blank"
              rel="noopener noreferrer"
              title="Personal Website"
              aria-label="Personal Website"
            >
              <Link
                className="inline-block size-[1em] cursor-pointer align-[-0.125em]"
                aria-hidden
              />
            </NavyLink>
          )}
        </LinkIcons>
      </CardContents>
    </StyledCard>
  );
};

export default ProfileCard;
