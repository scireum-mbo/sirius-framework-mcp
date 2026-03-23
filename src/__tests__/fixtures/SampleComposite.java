package sirius.biz.test;

import sirius.db.mixing.Composite;
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;

public class SampleComposite extends Composite {

    public static final Mapping STREET = Mapping.named("street");
    @Length(255)
    private String street;

    public static final Mapping CITY = Mapping.named("city");
    @Length(255)
    private String city;

    public String getStreet() {
        return street;
    }

    public String getCity() {
        return city;
    }
}
