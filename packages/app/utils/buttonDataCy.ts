import { ButtonProps } from "antd";

/**
 * Adds a `data-cy` attribute (for Cypress) to antd button props, such as a
 * Modal's or Popconfirm's `okButtonProps`. antd passes it on to the <button>,
 * but its ButtonProps type doesn't list data-* attributes, so it can't be
 * written in the object directly.
 */
export function buttonDataCy(
  name: string,
  props: ButtonProps = {}
): ButtonProps {
  return { ...props, ...{ "data-cy": name } };
}
