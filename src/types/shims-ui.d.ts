declare module "@/components/ui/*" {
  const anyComp: any;
  export default anyComp;
  export const Button: any;
  export const Label: any;
  export const Input: any;
  export const Textarea: any;
  export const Select: any;
  export const SelectItem: any;
  export const AuthLayout: any;
  export const InputOTP: any;
  export const InputOTPGroup: any;
  export const InputOTPSlot: any;
  export const Loader2: any;
}

declare module "input-otp" {
  const InputOTP: any;
  const InputOTPGroup: any;
  const InputOTPSlot: any;
  export { InputOTP, InputOTPGroup, InputOTPSlot };
  export default InputOTP;
}

