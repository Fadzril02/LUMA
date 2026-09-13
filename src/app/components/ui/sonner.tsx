import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      richColors
      position="top-right"
      closeButton
      className="toaster group font-sans"
      {...props}
    />
  );
};

export { Toaster };
