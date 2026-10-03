import
{
    IsNotEmpty,
    IsString,
    Matches,
    MinLength,
} from 'class-validator';

export class CreateRiderDto
{
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        {
            message: 'Please provide a valid email address',
        },
    )
    email!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(
        /^01[3-9]\d{8}$/,
        {
            message: 'Please provide a valid Bangladeshi phone number',
        },
    )
    phone!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(
        /^\d{10}$/,
        {
            message: 'NID number must be 10 digits',
        },
    )
    nidNumber!: string;

    @IsString()
    @IsNotEmpty()
    drivingLicenseNumber!: string;

    @IsString()
    @IsNotEmpty()
    vehicleType!: string;

    @IsString()
    @IsNotEmpty()
    vehicleNumber!: string;
}