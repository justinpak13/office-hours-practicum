import React, { ReactElement } from "react";
import styled from "styled-components";
import ProfileCard from "./ProfileCard";
import { VerticalDivider } from "../Settings/SettingsPage";

const Title = styled.div`
  text-align: center;
  color: #212934;
  font-weight: 500;
  font-size: 30px;
`;
const Description = styled.div`
  text-align: left;
  color: #5f6b79;
  font-size: 14px;
  margin-top: 15px;
`;
const ProfilesTitle = styled(Title)`
  text-align: left;
  border-bottom: 1px solid #cfd6de;
  font-size: 20px;
  margin-bottom: 10px;
`;
const ProfilesSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  margin-bottom: 30px;
`;

export default function AboutPage(): ReactElement {
  return (
    <div className="flex min-w-0 py-5">
      <div className="relative mx-[30px] min-h-px max-w-[29.16666667%] flex-[0_0_29.16666667%]">
        <Title>About Us</Title>
        <Description>
          <p>
            Khoury Office Hours was developed and maintained by a group of
            student developers and designers from
            <a href="https://www.sandboxnu.com/"> Sandbox</a>, the student-led
            software consultancy at Northeastern. Our mission is to enhance the
            student experience by making office hours more efficient and
            transparent.
          </p>
          <p>
            We began developing Khoury Office Hours in May 2020, and first
            launched the app in Fall 2020 to 4 courses. We now support around 20
            courses with over 2,500 registered users. Check us out{" "}
            <a href="https://news.northeastern.edu/2021/02/02/this-app-helps-students-get-more-face-time-with-professors/">
              {" "}
              in the news{" "}
            </a>
            to learn more.
          </p>
          <p>
            Since 2022, Sandbox has handed over control of the App to Khoury.
          </p>
          <p>
            <strong>Contact the Khoury IT team: </strong>
            <a href="mailto:khoury-systems@northeastern.edu">
              {" "}
              khoury-systems@northeastern.edu
            </a>
          </p>
        </Description>
      </div>
      <VerticalDivider />
      <div className="inline-flex grow flex-col gap-10 pt-5">
        <div className="relative min-h-px max-w-full">
          <ProfilesTitle>Past Members</ProfilesTitle>
          <ProfilesSection>
            {PROFILES_PAST.map((prof, idx) => (
              <ProfileCard
                key={idx}
                name={prof.name}
                role={prof.role}
                linkedin={prof.linkedin}
                personalSite={prof.personalSite}
              />
            ))}
          </ProfilesSection>
        </div>
      </div>
    </div>
  );
}

// These images links are generated from a gdrive sharing link using this tool:
// https://buildbrothers.com/gdrive-generator/
// which is described in this article: https://blog.usejournal.com/host-static-images-for-your-apps-or-website-on-google-drive-hotlink-to-gdrive-images-358d6fcf8ef7
// The images are stored in the drive folder Sandbox Members/Office Hours/About Page Images
const PROFILES_PAST = [
  {
    name: "Danish Farooq",
    role: "Project Lead",
    linkedin: "https://www.linkedin.com/in/danishfarooq610/",
  },
  {
    name: "Iris Liu",
    role: "Tech Lead",
    linkedin: "https://www.linkedin.com/in/iris-liu-curiously",
  },
  {
    name: "Brian Yang",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/brianyyang/",
  },
  {
    name: "Vera Kong",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/vera-kong/",
    personalSite: "https://vkong6019.github.io/",
  },
  {
    name: "Nicole Danuwidjaja",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/nicoledanuwidjaja/",
    personalSite: "https://nicoledanuwidjaja.github.io/",
  },
  {
    name: "Neel Bhalla",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/neelbhalla2021/",
  },
  {
    name: "Tingwei Shi",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/tingwei-shi",
  },
  {
    name: "Megan Chong",
    role: "Designer",
    linkedin: "https://www.linkedin.com/in/megan-chong-/",
    personalSite: "https://www.megan-chong.com",
  },
  {
    name: "Aislin Black",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/aislin-black-0b6b64180/",
    personalSite: "",
  },
  {
    name: "Da-Jin Chu",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/dajinchu/",
    personalSite: "",
  },
  {
    name: "Alex Takayama",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/alexander-takayama/",
    personalSite: "",
  },
  {
    name: "Stanley Liu",
    role: "Project Lead",
    linkedin: "https://www.linkedin.com/in/stanleyspliu/",
  },
  {
    name: "Eddy Li",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/eddy-li/",
    personalSite: "https://eddyli.dev/",
  },
  {
    name: "Will Stenzel",
    role: "Developer",
    personalSite: "https://willstenzel.com/",
  },
  {
    name: "Olivia Floody",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/olivia-floody-a7b5a4154/",
  },
  {
    name: "Alexandra Kopel",
    role: "Designer",
    personalSite: "https://alexkopel.myportfolio.com/",
  },
];
